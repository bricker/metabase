import { useFormikContext } from "formik";
import type { Dispatch, SetStateAction } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAsync } from "react-use";
import { c, t } from "ttag";
import _ from "underscore";

import { useDatabaseListQuery } from "metabase/common/hooks";
import { LeaveConfirmationModalContent } from "metabase/components/LeaveConfirmationModal";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import Modal from "metabase/components/Modal";
import {
  Form,
  FormProvider,
  FormRadioGroup,
  FormSubmitButton,
  FormTextInput,
} from "metabase/forms";
import { color } from "metabase/lib/colors";
import { PLUGIN_CACHING } from "metabase/plugins";
import { CacheConfigApi } from "metabase/services";
import type { IconName } from "metabase/ui";
import {
  Box,
  Button,
  FixedSizeIcon,
  Flex,
  Grid,
  Radio,
  Stack,
  Text,
  Title,
  Tooltip,
} from "metabase/ui";
import type Database from "metabase-lib/metadata/Database";

import { useStrategyDefaults } from "../hooks/useDefaults";
import { useRequests } from "../hooks/useRequests";
import type {
  Config,
  GetConfigByModelId,
  Model,
  ModelId,
  Strat,
  StrategyType,
} from "../types";
import { getShortStrategyLabel, isValidStrategy, Strategies } from "../types";
import { strategyValidationSchema } from "../validation";

import { Chip, Panel, TabWrapper } from "./StrategyEditorForDatabases.styled";

type SafelyUpdateTargetId = (
  newTargetId: ModelId | null,
  isFormDirty: boolean,
  callback?: () => void,
) => void;

export const StrategyEditorForDatabases = ({
  tabsRef,
  setTabsHeight,
}: {
  tabsRef: React.RefObject<HTMLDivElement>;
  setTabsHeight: (height: number) => void;
}) => {
  const {
    data: unfilteredDatabases = null,
    error: errorWhenLoadingDatabases,
    isLoading: areDatabasesLoading,
  } = useDatabaseListQuery();

  const databases = unfilteredDatabases?.filter(
    PLUGIN_CACHING.canConfigureDatabase,
  );

  const canOnlyConfigureRootStrategy = databases?.length === 0;

  const {
    value: configsFromAPI,
    loading: areConfigsLoading,
    error: errorWhenLoadingConfigs,
  }: {
    value?: Config[];
    loading: boolean;
    error?: any;
  } = useAsync(async () => {
    const lists = [CacheConfigApi.list({ model: "root" })];
    if (!canOnlyConfigureRootStrategy) {
      lists.push(CacheConfigApi.list({ model: "database" }));
    }
    const [rootConfigsFromAPI, savedConfigsFromAPI] = await Promise.all(lists);
    const configs = [
      ...(rootConfigsFromAPI?.items ?? []),
      ...(savedConfigsFromAPI?.items ?? []),
    ];
    return configs;
  }, []);

  const [configs, setConfigs] = useState<Config[]>([]);

  const [shouldShowDBList, setShouldShowDBList] = useState(true);

  useEffect(() => {
    if (configsFromAPI) {
      setConfigs(configsFromAPI);
    }
  }, [configsFromAPI]);

  const savedConfigs: GetConfigByModelId = useMemo(() => {
    const map: GetConfigByModelId = new Map();
    databases?.forEach(db => {
      const matchingConfig = configs.find(config => config.model_id === db.id);
      if (matchingConfig) {
        map.set(db.id, matchingConfig);
      }
    });
    const savedRootStrategy = configs.find(
      config => config.model === "root",
    )?.strategy;
    if (savedRootStrategy) {
      map.set("root", {
        model: "root",
        model_id: 0,
        strategy: savedRootStrategy,
      });
    }
    return map;
  }, [configs, databases]);

  // This may be needed if the form's live data needs to be displayed elsewhere
  // /** The configurations displayed in the form, which may not yet be saved */
  // const liveConfigs = useMemo(
  //   () => {
  //     const liveConfigs = new Map(savedConfigs);
  //     databases?.forEach(db => {
  //       const savedConfig = savedConfigs.get(db.id);
  //       const liveConfig = savedConfig ?? {
  //         model: "database",
  //         model_id: db.id,
  //         strategy: { type: "inherit" }
  //       };
  //       liveConfigs.set(db.id, liveConfig);
  //     });
  //     return liveConfigs;
  //   }, [databases]
  // );

  /** Id of the database currently being edited, or 'root' for the root strategy */
  const [targetId, setTargetId] = useState<ModelId | null>(null);

  const onConfirmDiscardChanges = useRef<() => void>(() => null);

  const safelyUpdateTargetId: SafelyUpdateTargetId = (
    newTargetId,
    isFormDirty,
    callback = () => null,
  ) => {
    if (targetId === newTargetId) {
      return;
    }
    const proceed = () => {
      setTargetId(newTargetId);
      callback();
    };
    if (isFormDirty) {
      setShowCancelEditWarning(true);
      onConfirmDiscardChanges.current = proceed;
    } else {
      proceed();
    }
  };

  const rootStrategy = savedConfigs.get("root")?.strategy ?? {
    type: "nocache",
  };

  useEffect(() => {
    if (targetId === "root") {
      setShouldShowDBList(false);
    }
  }, [targetId]);

  /** The config for the currently edited database, or the root strategy */
  const targetConfig = savedConfigs.get(targetId);
  const savedStrategy = targetConfig?.strategy;
  const defaults = useStrategyDefaults(databases, targetConfig);

  const { debouncedRequest, showSuccessToast, showErrorToast } = useRequests();

  useEffect(() => {
    if (canOnlyConfigureRootStrategy) {
      setTargetId("root");
    }
  }, [canOnlyConfigureRootStrategy]);

  const setStrategy = useCallback(
    (model: Model, model_id: number, newStrategy: Strat | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );

      const configBeforeChange = savedConfigs.get(model_id);
      const onSuccess = async () => {
        await showSuccessToast();
      };
      const onError = async () => {
        await showErrorToast();
        // Revert to earlier state
        setConfigs(
          configBeforeChange
            ? [...otherConfigs, configBeforeChange]
            : otherConfigs,
        );
        // FIXME: this reverts to an earlier state even if the user has already
        // changed the value again. We should revert only if there is no newer
        // change
      };

      if (newStrategy) {
        const newConfig: Config = {
          ...baseConfig,
          strategy: newStrategy,
        };
        setConfigs([...otherConfigs, newConfig]);
        debouncedRequest(
          CacheConfigApi.update,
          newConfig,
          {},
          onSuccess,
          onError,
        );
      } else {
        setConfigs(otherConfigs);
        debouncedRequest(
          CacheConfigApi.delete,
          baseConfig,
          { hasBody: true },
          onSuccess,
          onError,
        );
      }
    },
    [configs, savedConfigs, debouncedRequest, showErrorToast, showSuccessToast],
  );

  const setRootStrategy = (newStrategy: Strat) =>
    setStrategy("root", 0, newStrategy);
  const setDBStrategy = (databaseId: number, newStrategy: Strat | null) =>
    setStrategy("database", databaseId, newStrategy);

  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);

  // TODO: If this doesn't need to depend on areDatabasesLoading etc then move it up
  useLayoutEffect(() => {
    const handleResize = () => {
      const tabs = tabsRef.current;
      if (!tabs) {
        return;
      }
      const tabsElementTop = tabs.getBoundingClientRect().top;
      const newHeight = window.innerHeight - tabsElementTop - tabs.clientTop;
      setTabsHeight(newHeight);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    setTimeout(handleResize, 50);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [tabsRef, setTabsHeight, areDatabasesLoading, areConfigsLoading]);

  const [showCancelEditWarning, setShowCancelEditWarning] = useState(false);

  useEffect(
    /**
     * @see https://metaboat.slack.com/archives/C02H619CJ8K/p1709558533499399
     */
    function delayLoadingSpinner() {
      setTimeout(() => {
        setShowLoadingSpinner(true);
      }, 300);
    },
    [],
  );

  const savedStrategyType = savedStrategy?.type ?? "inherit";

  /** The strategy displayed in the form. It might not be saved yet. */
  const [selectedStrategyType, setSelectedStrategyType] =
    useState<StrategyType>(savedStrategyType);

  useEffect(() => {
    setSelectedStrategyType(savedStrategyType);
  }, [savedStrategyType, targetId]);

  const defaultsForCurrentTargetAndStrategy = targetId
    ? defaults?.get(targetId)?.[selectedStrategyType]
    : null;

  const selectedStrategy = {
    ...defaultsForCurrentTargetAndStrategy,
    type: selectedStrategyType,
  } as Strat;

  const showEditor = targetId !== null;

  const saveStrategy = (newStrategyValues: Partial<Strat> | null) => {
    const strategyType: StrategyType | undefined =
      newStrategyValues?.type ?? savedStrategy?.type;
    const relevantDefaults =
      targetId && strategyType ? defaults?.get(targetId)?.[strategyType] : null;
    const newStrategy = newStrategyValues
      ? {
          ...relevantDefaults,
          ...newStrategyValues,
        }
      : null;
    if (newStrategy !== null && !isValidStrategy(newStrategy)) {
      console.error(`Invalid strategy: ${JSON.stringify(newStrategy)}`);
      return;
    }
    if (targetId === "root") {
      if (newStrategy === null) {
        console.error("Cannot delete root strategy");
      } else {
        setRootStrategy(newStrategy);
      }
    } else if (targetId !== null) {
      setDBStrategy(targetId, newStrategy);
    } else {
      console.error("No target specified");
    }
  };

  if (errorWhenLoadingConfigs || areConfigsLoading) {
    return showLoadingSpinner ? (
      <LoadingAndErrorWrapper
        error={errorWhenLoadingConfigs}
        loading={areConfigsLoading}
      />
    ) : null;
  }

  if (errorWhenLoadingDatabases || areDatabasesLoading) {
    return showLoadingSpinner ? (
      <LoadingAndErrorWrapper
        error={errorWhenLoadingDatabases}
        loading={areDatabasesLoading}
      />
    ) : null;
  }

  const rootStrategyIconName = Strategies[rootStrategy.type].iconName;

  const handleFormSubmit = (values: Partial<Strat>) => {
    saveStrategy(
      values.type === "inherit"
        ? null // Delete the strategy
        : { ...savedStrategy, ...values },
    );
  };

  return (
    <FormProvider<Strat>
      initialValues={selectedStrategy}
      validationSchema={strategyValidationSchema}
      onSubmit={handleFormSubmit}
      enableReinitialize={true}
    >
      <TabWrapper role="region" aria-label="Data caching settings">
        <Text component="aside" lh="1rem" maw="32rem" mb="1.5rem">
          {PLUGIN_CACHING.explanation}
        </Text>
        <Modal isOpen={showCancelEditWarning}>
          <LeaveConfirmationModalContent
            onAction={() => {
              onConfirmDiscardChanges.current();
            }}
            onClose={() => setShowCancelEditWarning(false)}
          />
        </Modal>
        <Grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            overflow: "hidden",
          }}
          w="100%"
          mb="1rem"
        >
          {!canOnlyConfigureRootStrategy && (
            <>
              {/* Root strategy */}
              <Panel
                role="group"
                style={{ backgroundColor: color("bg-light"), zIndex: 3 }}
              >
                <Button
                  variant="subtle"
                  p=".25rem .5rem"
                  fw="bold"
                  mb=".5rem"
                  lh="1.5rem"
                  rightIcon={<FixedSizeIcon name="chevronright" />}
                  styles={{
                    root: {
                      backgroundColor: shouldShowDBList
                        ? color("bg-medium")
                        : "transparent",
                      "&:hover": {
                        backgroundColor: shouldShowDBList
                          ? color("bg-medium")
                          : "transparent",
                      },
                    },
                    inner: {
                      justifyContent: "space-between",
                    },
                  }}
                  onClick={() => {
                    if (!shouldShowDBList) {
                      setShouldShowDBList(isVisible => !isVisible);
                    }
                  }}
                >
                  <Flex gap="0.5rem" w="100%" align="center">
                    <FixedSizeIcon name="database" />
                    <Title color="inherit" order={5}>{t`Databases`}</Title>
                  </Flex>
                </Button>
                <RootStrategyChip
                  rootStrategy={rootStrategy}
                  rootStrategyIconName={rootStrategyIconName}
                  targetId={targetId}
                  safelyUpdateTargetId={safelyUpdateTargetId}
                  setShouldShowDBList={setShouldShowDBList}
                />
              </Panel>
              {shouldShowDBList && (
                <Panel
                  $animate
                  role="group"
                  style={{
                    borderStartEndRadius: 0,
                    borderEndEndRadius: 0,
                    zIndex: 2,
                  }}
                >
                  {databases?.map(db => (
                    <DatabaseWidget
                      db={db}
                      key={db.id.toString()}
                      savedConfigs={savedConfigs}
                      targetId={targetId}
                      safelyUpdateTargetId={safelyUpdateTargetId}
                      selectedStrategy={selectedStrategy}
                    />
                  ))}
                </Panel>
              )}
            </>
          )}
          {showEditor && (
            <Editor
              selectedStrategy={selectedStrategy}
              setSelectedStrategyType={setSelectedStrategyType}
              savedStrategy={savedStrategy}
              targetId={targetId}
            />
          )}
        </Grid>
      </TabWrapper>
    </FormProvider>
  );
};

export const Editor = ({
  selectedStrategy,
  setSelectedStrategyType,
  savedStrategy,
  targetId,
}: {
  selectedStrategy: Strat;
  setSelectedStrategyType: Dispatch<SetStateAction<StrategyType>>;
  savedStrategy?: Strat;
  targetId: ModelId;
}) => {
  return (
    <Panel style={{ zIndex: 1 }} $animate>
      <Form
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        <Stack spacing="xl">
          <StrategySelector
            targetId={targetId}
            savedStrategy={selectedStrategy}
            setSelectedStrategy={setSelectedStrategyType}
          />
          {selectedStrategy.type === "ttl" && (
            <>
              <section>
                <Title order={4}>{t`Minimum query duration`}</Title>
                <p>
                  {t`Metabase will cache all saved questions with an average query execution time longer than this many seconds:`}
                </p>
                <PositiveNumberInput fieldName="min_duration" />
              </section>
              <section>
                <Title
                  order={4}
                >{t`Cache time-to-live (TTL) multiplier`}</Title>
                <p>
                  {t`To determine how long each saved question's cached result should stick around, we take the query's average execution time and multiply that by whatever you input here. So if a query takes on average 2 minutes to run, and you input 10 for your multiplier, its cache entry will persist for 20 minutes.`}
                </p>
                <PositiveNumberInput fieldName="multiplier" />
              </section>
            </>
          )}
          {selectedStrategy.type === "duration" && (
            <section>
              <Title
                order={4}
                mb=".5rem"
              >{t`Cache result for this many hours`}</Title>
              <PositiveNumberInput fieldName="duration" />
            </section>
          )}
          {/*
              {selectedStrategy === "schedule" && (
                  <section>
                    <Title order={3}>{t`Schedule`}</Title>
                    <p>{t`(explanation goes here)`}</p>
                    <CronInput
                      initialValue={savedStrategy.schedule}
                    />
                  </section>
              )}
                */}
        </Stack>
        <FormButtons
          savedStrategy={savedStrategy}
          selectedStrategy={selectedStrategy}
        />
      </Form>
      {/*
          <StrategyConfig />
              Add later
              <section>
              <p>
              {jt`We’ll periodically run ${(
              <code>select max()</code>
              )} on the column selected here to check for new results.`}
              </p>
              <Select data={columns} />
TODO: I'm not sure this string translates well
</section>
<section>
<p>{t`Check for new results every...`}</p>
<Select data={durations} />
</section>
            */}
    </Panel>
  );
};

export const FormButtons = ({
  savedStrategy,
  selectedStrategy,
}: {
  savedStrategy?: Strat;
  selectedStrategy?: Strat;
}) => {
  const dirty =
    useFormikContext().dirty || savedStrategy?.type !== selectedStrategy?.type;
  if (!dirty) {
    return null;
  }
  return (
    <Box mt="2rem">
      <Button variant="subtle">{t`Cancel`}</Button>
      <FormSubmitButton label={t`Save changes`} variant="filled" />
    </Box>
  );
};

export const DatabaseWidget = ({
  db,
  savedConfigs,
  targetId,
  safelyUpdateTargetId,
  selectedStrategy,
}: {
  db: Database;
  targetId: ModelId | null;
  savedConfigs: GetConfigByModelId;
  safelyUpdateTargetId: SafelyUpdateTargetId;
  selectedStrategy?: Strat;
}) => {
  const dbConfig = savedConfigs.get(db.id);
  const rootStrategy = savedConfigs.get("root")?.strategy;
  const savedDBStrategy = dbConfig?.strategy;
  const inheritsRootStrategy = savedDBStrategy === undefined;
  const strategyForDB = savedDBStrategy ?? rootStrategy;
  if (!strategyForDB) {
    throw new Error(t`Invalid strategy "${JSON.stringify(strategyForDB)}"`);
  }
  const isBeingEdited = targetId === db.id;
  const isFormDirty =
    useFormikContext().dirty ||
    savedDBStrategy?.type !== selectedStrategy?.type;

  return (
    <Box w="100%" fw="bold" mb="1rem" p="1rem">
      <Stack spacing="sm">
        <Flex gap="0.5rem" color="text-medium" align="center">
          <FixedSizeIcon name="database" color="inherit" />
          <Title color="inherit" order={5}>
            {db.name}
          </Title>
        </Flex>
        <Tooltip
          position="bottom"
          disabled={!inheritsRootStrategy}
          label={t`Inheriting from Databases setting`}
        >
          <Chip
            onClick={() => {
              if (targetId === db.id) {
                return;
              }
              safelyUpdateTargetId(db.id, isFormDirty);
            }}
            variant={isBeingEdited ? "filled" : "white"}
            ml="auto"
            w="100%"
            p="0.25rem 0.5rem"
            styles={{
              inner: { width: "100%", justifyContent: "space-between" },
            }}
            rightIcon={<FixedSizeIcon name="ellipsis" />}
          >
            <Flex wrap="nowrap" lh="1.5rem" gap=".5rem">
              {inheritsRootStrategy
                ? c(
                    "This label indicates that a database inherits its behavior from something else",
                  ).jt`Inherit:${(
                    <Box opacity={0.6}>
                      {getShortStrategyLabel(rootStrategy)}
                    </Box>
                  )}`
                : getShortStrategyLabel(strategyForDB)}
            </Flex>
          </Chip>
        </Tooltip>
      </Stack>
    </Box>
  );
};

const StrategySelector = ({
  targetId,
  savedStrategy,
  setSelectedStrategy,
}: {
  targetId: ModelId | null;
  savedStrategy?: Strat;
  setSelectedStrategy: Dispatch<SetStateAction<StrategyType>>;
}) => {
  const radioButtonMapRef = useRef<Map<string | null, HTMLInputElement>>(
    new Map(),
  );
  const radioButtonMap = radioButtonMapRef.current;
  const savedStrategyType = savedStrategy?.type ?? "inherit";

  useEffect(
    () => {
      if (savedStrategyType) {
        radioButtonMap.get(savedStrategyType)?.focus();
      }
    },
    // We only want to focus the radio button when the targetId changes,
    // not when the strategy changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetId],
  );

  const availableStrategies =
    targetId === "root" ? _.omit(Strategies, "inherit") : Strategies;

  return (
    <section>
      <FormRadioGroup
        label={
          <Text lh="1rem">{t`When should cached query results be invalidated?`}</Text>
        }
        name="type"
        onChange={(value: string) => {
          setSelectedStrategy(value as StrategyType);
        }}
      >
        <Stack mt="md" spacing="md">
          {_.map(availableStrategies, (option, name) => (
            <Radio
              ref={(el: HTMLInputElement) => {
                radioButtonMap.set(name, el);
              }}
              value={name}
              key={name}
              label={option.label}
            />
          ))}
        </Stack>
      </FormRadioGroup>
    </section>
  );
};

export const PositiveNumberInput = ({ fieldName }: { fieldName: string }) => {
  // NOTE: Known bug: on Firefox, if you type invalid input, the error
  // message will be "Required field" instead of "must be a positive number".
  return (
    <FormTextInput
      name={fieldName}
      type="number"
      min={1}
      styles={{
        input: {
          // This is text-align: right but RTL friendly
          textAlign: "end",
          maxWidth: "3.5rem",
        },
      }}
      autoComplete="off"
    />
  );
};

const RootStrategyChip = ({
  rootStrategy,
  rootStrategyIconName,
  targetId,
  safelyUpdateTargetId,
  setShouldShowDBList,
}: {
  rootStrategy: Strat;
  rootStrategyIconName: IconName | undefined;
  targetId: ModelId | null;
  safelyUpdateTargetId: SafelyUpdateTargetId;
  setShouldShowDBList: (isVisible: boolean) => void;
}) => {
  const isFormDirty = useFormikContext().dirty;
  return (
    <Chip
      leftIcon={
        rootStrategyIconName ? (
          <FixedSizeIcon name={rootStrategyIconName} />
        ) : undefined
      }
      styles={{
        inner: {
          display: "flex",
          flexFlow: "row nowrap",
          justifyContent: "flex-start",
          flex: 1,
        },
        label: {
          flex: 1,
          display: "flex",
          flexFlow: "row nowrap",
        },
      }}
      pt="0.25rem"
      pb="0.25rem"
      style={{
        paddingInlineStart: rootStrategyIconName ? "0.5rem" : ".65rem",
        paddingInlineEnd: "0.5rem",
      }}
      lh="1.5rem"
      w="100%"
      rightIcon={
        <FixedSizeIcon name="ellipsis" style={{ paddingInlineEnd: "2px" }} />
      }
      variant={targetId === "root" ? "filled" : "white"}
      onClick={() => {
        if (targetId === "root") {
          return;
        }
        safelyUpdateTargetId("root", isFormDirty, () => {
          setShouldShowDBList(false);
        });
      }}
    >
      {getShortStrategyLabel(rootStrategy)}
    </Chip>
  );
};
