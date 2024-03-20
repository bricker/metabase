import { useState } from "react";
import { t } from "ttag";

import { color } from "metabase/lib/colors";
import { FixedSizeIcon, Flex, Title, Tooltip } from "metabase/ui";

import type { Config, ModelId, SafelyUpdateTargetId } from "../types";
import { getShortStrategyLabel } from "../types";

import { PolicyToken } from "./StrategyEditorForDatabases.styled";
import { findWhere } from "underscore";

export const StrategyFormLauncher = ({
  forId,
  targetId,
  title,
  safelyUpdateTargetId,
  configs,
  isFormDirty,
}: {
  forId: ModelId;
  targetId: ModelId | null;
  title: string;
  safelyUpdateTargetId: SafelyUpdateTargetId;
  configs: Config[];
  isFormDirty: boolean;
}) => {
  const config = findWhere(configs, { model_id: forId });
  const rootConfig = findWhere(configs, { model: "root" });

  const rootStrategy = rootConfig?.strategy;
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
    <Flex
      w="100%"
      p="md"
      bg={forId === "root" ? color("bg-medium") : undefined}
      justify="space-between"
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
      <Tooltip
        position="bottom"
        disabled={!inheritsRootStrategy}
        label={t`Inheriting from default policy`}
      >
        <PolicyToken
          onClick={() => {
            if (targetId !== forId) {
              safelyUpdateTargetId(forId, isFormDirty);
            }
          }}
          // The hover state is in a React state variable so that it can determine the variant prop
          onMouseOver={() => setHovered(true)}
          onMouseOut={() => setHovered(false)}
          variant={buttonVariant}
          fw={inheritsRootStrategy ? "normal" : "bold"}
          p="0.25rem .75rem"
          styles={{
            root: {
              borderRadius: "7rem",
            },
          }}
        >
          <Flex wrap="nowrap" lh="1.5rem" gap=".5rem">
            {getShortStrategyLabel(
              inheritsRootStrategy ? rootStrategy : strategy,
            )}
          </Flex>
        </PolicyToken>
      </Tooltip>
    </Flex>
  );
};
