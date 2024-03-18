import { useFormikContext } from "formik";
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

// BUG: the confirmation modal is no longer working. time to add some tests so i can catch regressions like this!

//   // Ryan suggests thinking about the following: keep the form state more local to the form
//   // (so don't lift FormProvider up) and use something like onBeforeUnmount so that the form
//   // handles its own "confirm before closing" logic

//   // See if I can unify the two Chip components

//   // Use more components rather than having one big JSX

//   // Use forms/FormSubmitButton because it has good race condition logic built in

// export const DatabaseFormTrigger = ({
//   db,
//   savedConfigs,
//   targetId,
//   safelyUpdateTargetId,
// }: {
//   db: Database;
//   targetId: ModelId | null;
//   savedConfigs: GetConfigByModelId;
//   safelyUpdateTargetId: SafelyUpdateTargetId;
// }) => {
//   const dbConfig = savedConfigs.get(db.id);
//   const rootStrategy = savedConfigs.get("root")?.strategy;
//   const savedDBStrategy = dbConfig?.strategy;

//   const inheritsRootStrategy = savedDBStrategy === undefined;
//   const strategyForDB = savedDBStrategy ?? rootStrategy;
//   if (!strategyForDB) {
//     throw new Error(t`Invalid strategy "${JSON.stringify(strategyForDB)}"`);
//   }
//   const isBeingEdited = targetId === db.id;

//   const isFormDirty = useFormikContext().dirty;

//   return (
//     <Group
//       spacing="sm"
//       w="100%"
//       p="md"
//       fw="bold"
//       style={{ border: `1px solid ${color("border")}`, borderRadius: ".5rem" }}
//     >
//       <Flex gap="0.5rem" color="text-medium" align="center">
//         <FixedSizeIcon name="database" color="inherit" />
//         <Title color="inherit" order={5}>
//           {db.name}
//         </Title>
//       </Flex>
//       <Chip
//         onClick={
//           () => {
//           if (targetId === db.id) {
//             return;
//           }
//           safelyUpdateTargetId(db.id, isFormDirty);
//         }
//         }
//         // The hover state is in a state variable so that it can determine the variant prop
//         onMouseOver={() => setHovered(true)}
//         onMouseOut={() => setHovered(false)}
//         variant={buttonVariant}
//         style={{
//           // like margin-left but RTL friendly
//           marginInlineStart: "auto",
//         }}
//         p="0.25rem .75rem"
//         styles={{
//           root: {
//             borderRadius: "1rem",
//           },
//           inner: {
//             width: "100%",
//             justifyContent: "space-between",
//           },
//         }}
//       >
//         <Tooltip
//           position="bottom"
//           disabled={!inheritsRootStrategy}
//           label={t`Inheriting from Databases setting`}
//         >
//           <Flex wrap="nowrap" lh="1.5rem" gap=".5rem">
//             {getShortStrategyLabel(
//               inheritsRootStrategy ? rootStrategy : strategyForDB,
//             )}
//           </Flex>
//         </Tooltip>
//       </Chip>
//     </Group>
//   );
// };

export const DatabaseFormTrigger = ({
  forId,
  targetId,
  title,
  safelyUpdateTargetId,
  savedConfigs,
}: {
  forId: ModelId;
  targetId: ModelId | null;
  title: string;
  safelyUpdateTargetId: SafelyUpdateTargetId;
  savedConfigs: GetConfigByModelId;
}) => {
  const config = savedConfigs.get(forId);
  const rootStrategy = savedConfigs.get("root")?.strategy;
  const savedStrategy = config?.strategy;

  const inheritsRootStrategy = savedStrategy === undefined;
  const strategy = savedStrategy ?? rootStrategy;
  const isBeingEdited = targetId === forId;

  const isFormDirty = useFormikContext().dirty;
  const [hovered, setHovered] = useState(false);
  const buttonVariant =
    isBeingEdited || hovered
      ? "filled"
      : inheritsRootStrategy
      ? "white"
      : "outline";
  return (
    <Group
      spacing="sm"
      w="100%"
      p="md"
      fw="bold"
      style={{ border: `1px solid ${color("border")}`, borderRadius: ".5rem" }}
    >
      <Flex gap="0.5rem" color="text-medium" align="center">
        <FixedSizeIcon name="database" color="inherit" />
        <Title color="inherit" order={5}>
          {title}
        </Title>
      </Flex>
      <Chip
        onClick={() => {
          if (targetId === forId) {
            return;
          }
          safelyUpdateTargetId(forId, isFormDirty);
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
            borderRadius: "1rem",
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
