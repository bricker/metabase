import { useState } from "react";
import { t } from "ttag";

import { Select, Text } from "metabase/ui";
import { ClickActionControl } from "metabase/visualizations/components/ClickActions/ClickActionControl";
import { Container } from "metabase/visualizations/components/ClickActions/ClickActionsPopover.styled";
import { ClickActionsViewSection } from "metabase/visualizations/components/ClickActions/ClickActionsViewSection";
import type {
  ClickActionPopoverProps,
  Drill,
  RegularClickAction,
} from "metabase/visualizations/types/click-actions";
import * as Lib from "metabase-lib";

import {
  fromSelectValue,
  getColumnOptions,
  toSelectValue,
} from "../combine-columns-drill/utils";

export const columnExtractDrill: Drill<Lib.ColumnExtractDrillThruInfo> = ({
  drill,
  drillInfo,
  clicked,
  applyDrill,
  query,
  stageIndex,
}) => {
  const DrillPopover = ({ onClick }: ClickActionPopoverProps) => {
    const extractActions: RegularClickAction[] = drillInfo.extractions.map(
      extraction => ({
        name: `extract.${extraction.displayName}`,
        title: extraction.displayName,
        section: "extract-popover",
        buttonType: "horizontal",
        question: () => applyDrill(drill, extraction.key),
        extra: () => ({ settingsSyncOptions: { column: clicked.column } }),
      }),
    );
    const columns = Lib.visibleColumns(query, stageIndex);
    const availableColumns = columns.filter(column => {
      const info = Lib.displayInfo(query, stageIndex, column);
      return (
        info.table?.name === "ORDERS" &&
        ["Created At", "Discount"].includes(info.displayName)
      );
    });
    const options = getColumnOptions(query, stageIndex, availableColumns);
    const [sourceColumn, setSourceColumn] = useState<Lib.ColumnMetadata | null>(
      null,
    );
    const urlActions = [
      { ...extractActions[0], title: "Domain" },
      { ...extractActions[1], title: "Top-level domain" },
    ];
    const actions =
      sourceColumn &&
      Lib.displayInfo(query, stageIndex, sourceColumn).displayName ===
        "Discount"
        ? urlActions
        : extractActions;

    return (
      <>
        <Container>
          <Text mb="sm" weight="bold">
            {drillInfo.displayName}
          </Text>

          <Select
            data={options}
            placeholder={t`Choose source column`}
            styles={{
              wrapper: {
                "&:not(:only-child)": {
                  marginTop: 0,
                },
              },
            }}
            initiallyOpened
            value={sourceColumn ? toSelectValue(options, sourceColumn) : null}
            onChange={value => {
              const column = fromSelectValue(options, value);
              setSourceColumn(column);
            }}
          />

          {sourceColumn && (
            <ClickActionsViewSection
              title={t`Select a part to extract`}
              contentDirection={"column"}
              type={"extract-popover"}
            >
              {actions.map(action => (
                <ClickActionControl
                  key={action.name}
                  action={action}
                  onClick={() => onClick(action)}
                />
              ))}
            </ClickActionsViewSection>
          )}
        </Container>
      </>
    );
  };

  return [
    {
      name: "extract",
      title: drillInfo.displayName,
      section: "extract",
      icon: "extract",
      buttonType: "horizontal",
      popover: DrillPopover,
    },
  ];
};
