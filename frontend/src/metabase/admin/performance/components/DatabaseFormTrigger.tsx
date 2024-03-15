import { useFormikContext } from "formik";
import { c, t } from "ttag";

import { color } from "metabase/lib/colors";
import { Box, FixedSizeIcon, Flex, Stack, Title, Tooltip } from "metabase/ui";
import type Database from "metabase-lib/metadata/Database";

import type {
  GetConfigByModelId,
  ModelId,
  SafelyUpdateTargetId,
} from "../types";
import { getShortStrategyLabel } from "../types";

import { Chip } from "./StrategyEditorForDatabases.styled";

// BUG: the confirmation modal is no longer working. time to add some tests so i can catch regressions like this!

export const DatabaseFormTrigger = ({
  db,
  savedConfigs,
  targetId,
  safelyUpdateTargetId,
}: {
  db: Database;
  targetId: ModelId | null;
  savedConfigs: GetConfigByModelId;
  safelyUpdateTargetId: SafelyUpdateTargetId;
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

  const isFormDirty = useFormikContext().dirty;

  // Ryan suggests thinking about the following: keep the form state more local to the form
  // (so don't lift FormProvider up) and use something like onBeforeUnmount so that the form
  // handles its own "confirm before closing" logic

  // See if I can unify the two Chip components

  // Use more components rather than having one big JSX

  // Use forms/FormSubmitButton because it has good race condition logic built in

  return (
    <Box
      w="100%"
      p="md"
      fw="bold"
      style={{ border: `1px solid ${color("border")}`, borderRadius: ".5rem" }}
    >
      <Stack spacing="sm">
        <Flex gap="0.5rem" color="text-medium" align="center">
          <FixedSizeIcon name="database" color="inherit" />
          <Title color="inherit" order={5}>
            {db.name}
          </Title>
        </Flex>
        <Chip
          onClick={() => {
            if (targetId === db.id) {
              return;
            }
            safelyUpdateTargetId(db.id, isFormDirty);
          }}
          variant={
            isBeingEdited
              ? "filled"
              : inheritsRootStrategy
              ? "white"
              : "outline"
          }
          style={{
            // like margin-left but RTL friendly
            marginInlineStart: "auto",
          }}
          w="100%"
          p="0.25rem 0.5rem"
          styles={{
            inner: { width: "100%", justifyContent: "space-between" },
          }}
          rightIcon={<FixedSizeIcon name="ellipsis" />}
        >
          <Tooltip
            position="bottom"
            disabled={!inheritsRootStrategy}
            label={t`Inheriting from Databases setting`}
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
          </Tooltip>
        </Chip>
      </Stack>
    </Box>
  );
};
