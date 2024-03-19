import { useState } from "react";
import { t } from "ttag";

import { color } from "metabase/lib/colors";
import { FixedSizeIcon, Flex, Group, Title, Tooltip } from "metabase/ui";

import type {
  GetConfigByModelId,
  ModelId,
  SafelyUpdateTargetId,
} from "../types";
import { getShortStrategyLabel } from "../types";

import { Chip } from "./StrategyEditorForDatabases.styled";

export const StrategyFormLauncher = ({
  forId,
  targetId,
  title,
  safelyUpdateTargetId,
  savedConfigs,
  isStrategyFormDirty,
}: {
  forId: ModelId;
  targetId: ModelId | null;
  title: string;
  safelyUpdateTargetId: SafelyUpdateTargetId;
  savedConfigs: GetConfigByModelId;
  isStrategyFormDirty: boolean;
}) => {
  const config = savedConfigs.get(forId);
  const rootStrategy = savedConfigs.get("root")?.strategy;
  const savedStrategy = config?.strategy;

  const inheritsRootStrategy = savedStrategy === undefined;
  const strategy = savedStrategy ?? rootStrategy;
  const isBeingEdited = targetId === forId;

  const [hovered, setHovered] = useState(false);
  const buttonVariant =
    isBeingEdited || hovered
      ? "filled"
      : inheritsRootStrategy || forId === "root"
      ? "white"
      : "outline";
  return (
    <Group
      spacing="sm"
      w="100%"
      p="md"
      fw="bold"
      bg={forId === "root" ? color("bg-medium") : undefined}
      style={{
        border: `1px solid ${color(forId === "root" ? "bg-medium" : "border")}`,
        borderRadius: ".5rem",
      }}
    >
      <Flex gap="0.5rem" color="text-medium" align="center">
        <FixedSizeIcon
          name={forId === "root" ? "star" : "database"}
          color="inherit"
        />
        <Title color="inherit" order={5}>
          {title}
        </Title>
      </Flex>
      <Chip
        onClick={() => {
          if (targetId === forId) {
            return;
          }
          safelyUpdateTargetId(forId, isStrategyFormDirty);
        }}
        // The hover state is in a state variable so that it can determine the variant prop
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        variant={buttonVariant}
        style={{
          marginInlineStart: "auto",
        }}
        p="0.25rem .75rem"
        styles={{
          root: {
            borderRadius: "7rem",
          },
          inner: {
            width: "100%",
            justifyContent: "space-between",
          },
        }}
      >
        <Tooltip
          position="bottom"
          disabled={!inheritsRootStrategy}
          label={t`Inheriting from default policy`}
        >
          <Flex wrap="nowrap" lh="1.5rem" gap=".5rem">
            {getShortStrategyLabel(
              inheritsRootStrategy ? rootStrategy : strategy,
            )}
          </Flex>
        </Tooltip>
      </Chip>
    </Group>
  );
};
