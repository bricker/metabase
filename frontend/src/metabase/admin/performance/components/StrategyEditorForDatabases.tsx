import { useFormikContext } from "formik";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAsync } from "react-use";
import { t } from "ttag";

// BUG: the confirmation modal is no longer working. time to add some tests so i can catch regressions like this!

import { useDatabaseListQuery } from "metabase/common/hooks";
import { LeaveConfirmationModalContent } from "metabase/components/LeaveConfirmationModal";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import Modal from "metabase/components/Modal";
import { FormProvider } from "metabase/forms";
import { color } from "metabase/lib/colors";
import { PLUGIN_CACHING } from "metabase/plugins";
import { CacheConfigApi } from "metabase/services";
import type { IconName } from "metabase/ui";
import {
  Button,
  FixedSizeIcon,
  Flex,
  Grid,
  Stack,
  Text,
  Title,
} from "metabase/ui";

import { useRequests } from "../hooks/useRequests";
import type {
  Config,
  DurationStrategy,
  GetConfigByModelId,
  Model,
  ModelId,
  SafelyUpdateTargetId,
  Strat,
} from "../types";
import { getShortStrategyLabel, isValidStrategy, Strategies } from "../types";
import { strategyValidationSchema } from "../validation";

import { DatabaseFormTrigger } from "./DatabaseFormTrigger";
import { Chip, Panel, TabWrapper } from "./StrategyEditorForDatabases.styled";
import { StrategyForm } from "./StrategyForm";

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

  const configurableDatabases = unfilteredDatabases?.filter(
    PLUGIN_CACHING.canConfigureDatabase,
  );

  const canOnlyConfigureRootStrategy = configurableDatabases?.length === 0;
  const databases = configurableDatabases;

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

  /** The config for the database currently being edited,
   * or the config for the root strategy if that is what is being edited */
  const targetConfig = savedConfigs.get(targetId);
  const savedStrategy = targetConfig?.strategy;

  const { debouncedRequest, showSuccessToast, showErrorToast } = useRequests();

  const [isRequestPending, setIsRequestPending] = useState(false);

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

      const onSuccess = async () => {
        setIsRequestPending(false);
        await showSuccessToast();
      };
      const onError = async () => {
        setIsRequestPending(false);
        await showErrorToast();
      };

      setIsRequestPending(true);
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
    [configs, debouncedRequest, showErrorToast, showSuccessToast],
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

  const showStrategyForm = targetId !== null;

  const saveStrategy = (newStrategyValues: Partial<Strat> | null) => {
    const newStrategy = newStrategyValues
      ? {
          type: savedStrategy?.type,
          ...newStrategyValues,
        }
      : null;
    // TODO: Should the backend even accept/require a unit?
    if (newStrategy?.type === "duration") {
      (newStrategy as DurationStrategy).unit = "hours";
    }
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
    <FormProvider<Strat | Record<string, never>>
      initialValues={savedStrategy ?? { type: "inherit" }}
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
                  role="group"
                  style={{
                    borderStartEndRadius: 0,
                    borderEndEndRadius: 0,
                    zIndex: 2,
                  }}
                >
                  <Stack spacing="lg">
                    {databases?.map(db => (
                      <DatabaseFormTrigger
                        db={db}
                        key={db.id.toString()}
                        savedConfigs={savedConfigs}
                        targetId={targetId}
                        safelyUpdateTargetId={safelyUpdateTargetId}
                      />
                    ))}
                  </Stack>
                </Panel>
              )}
            </>
          )}
          {showStrategyForm && (
            <StrategyForm
              targetId={targetId}
              isRequestPending={isRequestPending}
            />
          )}
        </Grid>
      </TabWrapper>
    </FormProvider>
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
          flex: 1,
          flexFlow: "row nowrap",
          justifyContent: "flex-start",
        },
        label: {
          display: "flex",
          flex: 1,
          flexFlow: "row nowrap",
        },
      }}
      py="0.25rem"
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
