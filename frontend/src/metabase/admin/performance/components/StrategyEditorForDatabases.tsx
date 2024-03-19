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
//
// TODO:
// - ensure the buttons have the right logic
// - Ryan's suggestions

import { useDatabaseListQuery } from "metabase/common/hooks";
import { LeaveConfirmationModalContent } from "metabase/components/LeaveConfirmationModal";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import Modal from "metabase/components/Modal";
import { FormProvider } from "metabase/forms";
import { color } from "metabase/lib/colors";
import { PLUGIN_CACHING } from "metabase/plugins";
import { CacheConfigApi } from "metabase/services";
import { Button, Grid, Stack, Title } from "metabase/ui";

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
import { isValidStrategy } from "../types";
import { strategyValidationSchema } from "../validation";

import { DatabaseFormTrigger } from "./DatabaseFormTrigger";
import { Panel, TabWrapper } from "./StrategyEditorForDatabases.styled";
import { StrategyForm } from "./StrategyForm";

export const StrategyEditorForDatabases = ({
  tabsRef,
  setTabsHeight,
}: {
  tabsRef?: React.RefObject<HTMLDivElement>;
  setTabsHeight?: (height: number) => void;
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
    map.set("root", {
      model: "root",
      model_id: 0,
      strategy: savedRootStrategy ?? { type: "nocache" },
    });
    return map;
  }, [configs, databases]);

  const [
    /** Id of the model currently being edited */
    targetId,
    setTargetId,
  ] = useState<ModelId | null>(null);

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

  /** The config for the model currently being edited */
  const targetConfig = savedConfigs.get(targetId);
  const savedStrategy = targetConfig?.strategy;

  const { showSuccessToast, showErrorToast } = useRequests();

  const [isRequestPending, setIsRequestPending] = useState(false);

  const [wasRequestRecentlyPending, setWasRequestRecentlyPending] =
    useState(false);

  useEffect(() => {
    // Ensure this fires only after isRequestPending becomes false from true
    if (!isRequestPending) {
      setWasRequestRecentlyPending(true);
      const timeout = setTimeout(() => {
        setWasRequestRecentlyPending(false);
      }, 2000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [isRequestPending]);

  useEffect(() => {
    setWasRequestRecentlyPending(false);
  }, [targetId]);

  useEffect(() => {
    if (canOnlyConfigureRootStrategy) {
      setTargetId("root");
    }
  }, [canOnlyConfigureRootStrategy]);

  const setStrategy = useCallback(
    async (model: Model, model_id: number, newStrategy: Strat | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );

      const onSuccess = async () => {
        setIsRequestPending(false);
      };
      const onError = async () => {
        setIsRequestPending(false);
      };

      setIsRequestPending(true);
      if (newStrategy) {
        const newConfig: Config = {
          ...baseConfig,
          strategy: newStrategy,
        };
        await CacheConfigApi.update(newConfig)
          .then(onSuccess)
          .then(() => {
            setConfigs([...otherConfigs, newConfig]);
          })
          .catch(onError);
      } else {
        await CacheConfigApi.delete(baseConfig, { hasBody: true })
          .then(onSuccess)
          .then(() => {
            setConfigs(otherConfigs);
          })
          .catch(onError);
      }
    },
    [configs],
  );

  const setRootStrategy = async (newStrategy: Strat) =>
    await setStrategy("root", 0, newStrategy);
  const setDBStrategy = async (databaseId: number, newStrategy: Strat | null) =>
    await setStrategy("database", databaseId, newStrategy);

  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);

  // TODO: If this doesn't need to depend on areDatabasesLoading etc then move it up
  useLayoutEffect(() => {
    const handleResize = () => {
      const tabs = tabsRef?.current;
      if (!tabs) {
        return;
      }
      const tabsElementTop = tabs.getBoundingClientRect().top;
      const newHeight = window.innerHeight - tabsElementTop - tabs.clientTop;
      setTabsHeight?.(newHeight);
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

  const saveStrategy = async (newStrategyValues: Partial<Strat> | null) => {
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
        await setRootStrategy(newStrategy);
      }
    } else if (targetId !== null) {
      await setDBStrategy(targetId, newStrategy);
    } else {
      console.error("No target specified");
    }
  };

  const clearDBOverrides = useCallback(async () => {
    const originalConfigs = [...configs];
    setConfigs(configs => configs.filter(({ model }) => model !== "database"));

    const ids = configs.reduce<ModelId[]>(
      (acc, config) =>
        config.model === "database" ? [...acc, config.model_id] : acc,
      [],
    );

    if (ids.length === 0) {
      return;
    }

    const onSuccess = async () => {
      await showSuccessToast();
    };

    const onError = async () => {
      await showErrorToast();
      setConfigs(originalConfigs);
    };

    await CacheConfigApi.delete(
      { model_id: ids, model: "database" },
      { hasBody: true },
    )
      .then(onSuccess)
      .catch(onError);
  }, [configs, setConfigs, showErrorToast, showSuccessToast]);

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

  const handleFormSubmit = async (values: Partial<Strat>) => {
    await saveStrategy(
      values.type === "inherit"
        ? null // Delete the strategy
        : { ...savedStrategy, ...values },
    );
  };

  return (
    <FormProvider<Strat | Record<string, never>>
      key={targetId}
      initialValues={savedStrategy ?? { type: "inherit" }}
      validationSchema={strategyValidationSchema}
      onSubmit={handleFormSubmit}
      enableReinitialize={true}
    >
      <TabWrapper role="region" aria-label="Data caching settings">
        <Stack spacing="md" lh="1rem" maw="32rem" mb="1.5rem">
          <aside>{PLUGIN_CACHING.explanation}</aside>
          <Title order={4}>
            Pick the policy for when cached query results should be invalidated.
          </Title>
        </Stack>
        <Modal isOpen={showCancelEditWarning}>
          <LeaveConfirmationModalContent
            onAction={() => onConfirmDiscardChanges.current()}
            onClose={() => setShowCancelEditWarning(false)}
          />
        </Modal>
        <Grid
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            overflow: "hidden",
          }}
          w="100%"
          mx="0"
          mb="1rem"
        >
          {!canOnlyConfigureRootStrategy && (
            <Panel role="group" style={{ backgroundColor: color("bg-light") }}>
              <Stack
                p="lg"
                spacing="lg"
                style={{ borderBottom: `1px solid ${color("border")}` }}
              >
                <DatabaseFormTrigger
                  forId="root"
                  title={t`Default policy`}
                  savedConfigs={savedConfigs}
                  targetId={targetId}
                  safelyUpdateTargetId={safelyUpdateTargetId}
                />
              </Stack>
              <Stack p="lg" spacing="lg">
                {databases?.map(db => (
                  <DatabaseFormTrigger
                    forId={db.id}
                    title={db.name}
                    key={db.id.toString()}
                    savedConfigs={savedConfigs}
                    targetId={targetId}
                    safelyUpdateTargetId={safelyUpdateTargetId}
                  />
                ))}
                <Button
                  color={color("error")}
                  variant="subtle"
                  onClick={clearDBOverrides}
                >
                  {t`Reset all to default`}
                </Button>
              </Stack>
            </Panel>
          )}
          <Panel>
            {showStrategyForm && (
              <StrategyForm
                targetId={targetId}
                isRequestPending={isRequestPending}
                wasRequestRecentlyPending={wasRequestRecentlyPending}
              />
            )}
          </Panel>
        </Grid>
      </TabWrapper>
    </FormProvider>
  );
};

// const RootStrategyChip = ({
//   rootStrategy,
//   rootStrategyIconName,
//   targetId,
//   safelyUpdateTargetId,
// }: {
//   rootStrategy: Strat;
//   rootStrategyIconName: IconName | undefined;
//   targetId: ModelId | null;
//   safelyUpdateTargetId: SafelyUpdateTargetId;
// }) => {
//   const isFormDirty = useFormikContext().dirty;
//   return (
//     <Chip
//       styles={{
//         inner: {
//           display: "flex",
//           flex: 1,
//           flexFlow: "row nowrap",
//           justifyContent: "flex-start",
//         },
//         label: {
//           display: "flex",
//           flex: 1,
//           flexFlow: "row nowrap",
//         },
//       }}
//       py="0.25rem"
//       style={{
//         paddingInlineStart: rootStrategyIconName ? "0.5rem" : ".65rem",
//         paddingInlineEnd: "0.5rem",
//       }}
//       lh="1.5rem"
//       rightIcon={
//         <FixedSizeIcon name="ellipsis" style={{ paddingInlineEnd: "2px" }} />
//       }
//       variant={targetId === "root" ? "filled" : "white"}
//       onClick={() => {
//         if (targetId === "root") {
//           return;
//         }
//         safelyUpdateTargetId("root", isFormDirty);
//       }}
//     >
//       {getShortStrategyLabel(rootStrategy)}
//     </Chip>
//   );
// };
