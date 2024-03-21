import type { Dispatch, SetStateAction } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useAsync } from "react-use";
import { t } from "ttag";
import { findWhere } from "underscore";

import { useDatabaseListQuery } from "metabase/common/hooks";
import { LeaveConfirmationModalContent } from "metabase/components/LeaveConfirmationModal";
import Modal from "metabase/components/Modal";
import { Form, FormProvider, FormSubmitButton } from "metabase/forms";
import { color } from "metabase/lib/colors";
import { PLUGIN_CACHING } from "metabase/plugins";
import { CacheConfigApi } from "metabase/services";
import { Box, Flex, Grid, Stack, Text } from "metabase/ui";

import { useNoData } from "../hooks/useNoData";
import type {
  Config,
  DurationStrategy,
  Model,
  ModelId,
  SafelyUpdateTargetId,
  Strat,
} from "../types";
import { isValidStrategy } from "../types";
import { strategyValidationSchema } from "../validation";

import { Panel, TabWrapper } from "./StrategyEditorForDatabases.styled";
import { StrategyForm } from "./StrategyForm";
import { StrategyFormLauncher } from "./StrategyFormLauncher";

export const StrategyEditorForDatabases = ({
  tabsRef,
  setTabsHeight,
}: {
  tabsRef?: React.RefObject<HTMLDivElement>;
  setTabsHeight?: (height: number) => void;
}) => {
  const databasesResult = useDatabaseListQuery();
  const databases = databasesResult.data;

  const { canOnlyConfigureRootStrategy } = PLUGIN_CACHING;
  const canOverrideRootStrategy = !canOnlyConfigureRootStrategy;

  const configsResult = useAsync(async () => {
    const lists = [CacheConfigApi.list({ model: "root" })];
    if (!canOverrideRootStrategy) {
      lists.push(CacheConfigApi.list({ model: "database" }));
    }
    const [rootConfigsFromAPI, savedConfigsFromAPI] = await Promise.all(lists);

    const rootConfig = rootConfigsFromAPI?.items?.[0] ?? {
      model: "root",
      model_id: 0,
      strategy: { type: "nocache" },
    };
    const configs = [rootConfig];

    configs.push(...(savedConfigsFromAPI?.items ?? []));
    return configs;
  }, []);

  const configsFromAPI = configsResult.value;

  const [configs, setConfigs] = useState<Config[]>([]);

  useEffect(() => {
    if (configsFromAPI) {
      setConfigs(configsFromAPI);
    }
  }, [configsFromAPI]);

  const [
    /** Id of the model currently being edited */
    targetId,
    setTargetId,
  ] = useState<ModelId | null>(null);

  /** Callback that runs when the leave confirmation modal is accepted */
  const onConfirmLeave = useRef<() => void>(() => null);

  /** Update the targetId (the id of the currently edited model) but confirm if the form is unsaved */
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
      setShowLeaveConfirmationModal(true);
      onConfirmLeave.current = proceed;
    } else {
      proceed();
    }
  };

  /** The config for the model currently being edited */
  const targetConfig = findWhere(configs, { model_id: targetId ?? undefined });
  const savedStrategy = targetConfig?.strategy;

  useEffect(() => {
    if (canOnlyConfigureRootStrategy) {
      setTargetId("root");
    }
  }, [canOnlyConfigureRootStrategy]);

  const shouldShowStrategyFormLaunchers = !canOnlyConfigureRootStrategy;

  const setStrategy = useCallback(
    async (model: Model, model_id: number, newStrategy: Strat | null) => {
      const baseConfig: Pick<Config, "model" | "model_id"> = {
        model,
        model_id,
      };
      const otherConfigs = configs.filter(
        config => config.model_id !== model_id,
      );
      if (newStrategy) {
        const newConfig: Config = {
          ...baseConfig,
          strategy: newStrategy,
        };
        await CacheConfigApi.update(newConfig).then(() => {
          setConfigs([...otherConfigs, newConfig]);
        });
      } else {
        await CacheConfigApi.delete(baseConfig, { hasBody: true }).then(() => {
          setConfigs(otherConfigs);
        });
      }
    },
    [configs],
  );

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
  }, [
    tabsRef,
    setTabsHeight /* TODO: remove if not needed areDatabasesLoading, areConfigsLoading*/,
  ]);

  const [showLeaveConfirmationModal, setShowLeaveConfirmationModal] =
    useState(false);
  const [isStrategyFormDirty, setIsStrategyFormDirty] = useState(false);

  const showStrategyForm = targetId !== null;

  const saveStrategy = useCallback(
    async (newStrategyValues: Partial<Strat> | null) => {
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
          await setStrategy("root", 0, newStrategy);
        }
      } else if (targetId !== null) {
        await setStrategy("database", targetId, newStrategy);
      } else {
        console.error("No target specified");
      }
    },
    [savedStrategy, targetId, setStrategy],
  );

  const handleFormSubmit = async (values: Partial<Strat>) => {
    await saveStrategy(
      values.type === "inherit"
        ? null // Delete the strategy
        : { ...savedStrategy, ...values },
    );
  };

  const noData = useNoData(
    databasesResult.error || configsResult.error,
    databasesResult.isLoading || configsResult.loading,
  );
  if (noData) {
    return noData;
  }

  return (
    <TabWrapper role="region" aria-label="Data caching settings">
      <Stack spacing="xl" lh="1.5rem" maw="32rem" mb="1.5rem">
        <aside>{PLUGIN_CACHING.explanation}</aside>
      </Stack>
      <Modal isOpen={showLeaveConfirmationModal}>
        <LeaveConfirmationModalContent
          onAction={() => onConfirmLeave.current()}
          onClose={() => setShowLeaveConfirmationModal(false)}
        />
      </Modal>
      <Grid
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(auto, 30rem) 1fr",
          overflow: "hidden",
        }}
        w="100%"
        mx="0"
        mb="1rem"
      >
        {shouldShowStrategyFormLaunchers && (
          <Panel role="group" style={{ backgroundColor: color("bg-light") }}>
            <Box
              p="lg"
              style={{ borderBottom: `1px solid ${color("border")}` }}
            >
              <StrategyFormLauncher
                forId="root"
                title={t`Default policy`}
                configs={configs}
                targetId={targetId}
                safelyUpdateTargetId={safelyUpdateTargetId}
                isFormDirty={isStrategyFormDirty}
              />
            </Box>
            <Stack p="lg" spacing="md">
              {databases?.map(db => (
                <StrategyFormLauncher
                  forId={db.id}
                  title={db.name}
                  key={`database_${db.id}`}
                  configs={configs}
                  targetId={targetId}
                  safelyUpdateTargetId={safelyUpdateTargetId}
                  isFormDirty={isStrategyFormDirty}
                />
              ))}
              <ResetAllToDefaultButton
                configs={configs}
                setConfigs={setConfigs}
              />
            </Stack>
          </Panel>
        )}
        <Panel>
          {showStrategyForm && (
            <FormProvider<Strat | Record<string, never>>
              key={targetId}
              initialValues={savedStrategy ?? { type: "inherit" }}
              validationSchema={strategyValidationSchema}
              onSubmit={handleFormSubmit}
              enableReinitialize={true}
            >
              <StrategyForm
                targetId={targetId}
                setIsDirty={setIsStrategyFormDirty}
              />
            </FormProvider>
          )}
        </Panel>
      </Grid>
    </TabWrapper>
  );
};

const ResetAllToDefaultButton = ({
  configs,
  setConfigs,
}: {
  configs: Config[];
  setConfigs: Dispatch<SetStateAction<Config[]>>;
}) => {
  const resetAllToDefault = useCallback(async () => {
    const originalConfigs = [...configs];
    setConfigs((configs: Config[]) =>
      configs.filter(({ model }) => model !== "database"),
    );

    const ids = configs.reduce<ModelId[]>(
      (acc, config) =>
        config.model === "database" ? [...acc, config.model_id] : acc,
      [],
    );

    if (ids.length === 0) {
      return;
    }

    await CacheConfigApi.delete(
      { model_id: ids, model: "database" },
      { hasBody: true },
    ).catch(async () => {
      setConfigs(originalConfigs);
    });
  }, [configs, setConfigs]);

  return (
    <FormProvider initialValues={{}} onSubmit={resetAllToDefault}>
      <Form>
        <Flex justify="flex-end">
          <FormSubmitButton
            label={
              <Text
                fw="normal"
                color="error"
                // TODO: Add confirmation modal?
              >{t`Reset all to default`}</Text>
            }
            variant="subtle"
          />
        </Flex>
      </Form>
    </FormProvider>
  );
};
