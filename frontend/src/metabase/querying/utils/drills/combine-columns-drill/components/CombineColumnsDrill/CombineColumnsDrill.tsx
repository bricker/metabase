import type { FormEventHandler } from "react";
import { useMemo, useState } from "react";
import { jt, t } from "ttag";

import {
  Box,
  Button,
  Card,
  Flex,
  Icon,
  Select,
  Stack,
  Title,
} from "metabase/ui";
import type * as Lib from "metabase-lib";

import type { ColumnAndSeparator } from "../../types";
import {
  formatSeparator,
  fromSelectValue,
  getColumnOptions,
  getInitialColumnAndSeparator,
  getNextColumnAndSeparator,
  toSelectValue,
} from "../../utils";
import { ColumnAndSeparatorRow } from "../ColumnAndSeparatorRow";
import { Preview } from "../Preview";

import styles from "./CombineColumnsDrill.module.css";

interface Props {
  drill: Lib.DrillThru;
  drillInfo: Lib.CombineColumnsDrillThruInfo;
  query: Lib.Query;
  stageIndex: number;
  onSubmit: (columnsAndSeparators: ColumnAndSeparator[]) => void;
}

export const CombineColumnsDrill = ({
  drill,
  drillInfo,
  query,
  stageIndex,
  onSubmit,
}: Props) => {
  const { availableColumns, defaultSeparator } = drillInfo;

  const options = useMemo(() => {
    return getColumnOptions(query, stageIndex, availableColumns);
  }, [query, stageIndex, availableColumns]);
  const [sourceColumn, setSourceColumn] = useState<Lib.ColumnMetadata | null>(
    null,
  );
  const [columnsAndSeparators, setColumnsAndSeparators] = useState<
    ColumnAndSeparator[]
  >([]);
  const [isUsingDefaultSeparator, setIsUsingDefaultSeparator] = useState(false);

  const handleChange = (index: number, change: Partial<ColumnAndSeparator>) => {
    setColumnsAndSeparators(value => [
      ...value.slice(0, index),
      { ...value[index], ...change },
      ...value.slice(index + 1),
    ]);
  };

  const handleAdd = () => {
    setColumnsAndSeparators(value => [
      ...value,
      getNextColumnAndSeparator(
        drillInfo,
        sourceColumn,
        options,
        columnsAndSeparators,
      ),
    ]);
  };

  const handleRemove = (index: number) => {
    setColumnsAndSeparators(value => [
      ...value.slice(0, index),
      ...value.slice(index + 1),
    ]);
  };

  const handleEditSeparators = () => {
    setIsUsingDefaultSeparator(false);
  };

  const handleSubmit: FormEventHandler = event => {
    event.preventDefault();
    onSubmit(columnsAndSeparators);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className={styles.card} maw="100vw" miw={340} p="lg">
        <Title mb="md" order={4}>{t`Combine columns`}</Title>

        <Stack spacing="lg">
          <Select
            className={styles.column}
            data={options}
            // label={showLabels ? t`Column` : undefined}
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
              if (!sourceColumn) {
                setColumnsAndSeparators([
                  getInitialColumnAndSeparator(drillInfo, column),
                ]);
              }
              setSourceColumn(column);
            }}
          />
          {sourceColumn && (
            <>
              <Stack spacing="sm">
                <Stack className={styles.inputs} mah="50vh" spacing="sm">
                  {columnsAndSeparators.map(({ column, separator }, index) => (
                    <ColumnAndSeparatorRow
                      column={column}
                      index={index}
                      key={index}
                      options={options}
                      separator={separator}
                      showLabels={!isUsingDefaultSeparator && index === 0}
                      showRemove={columnsAndSeparators.length > 1}
                      showSeparator={!isUsingDefaultSeparator}
                      onChange={handleChange}
                      onRemove={handleRemove}
                    />
                  ))}
                </Stack>

                {isUsingDefaultSeparator && (
                  <Box>
                    <Button
                      p={0}
                      variant="subtle"
                      onClick={handleEditSeparators}
                    >
                      {jt`Separated by ${formatSeparator(defaultSeparator)}`}
                    </Button>
                  </Box>
                )}
              </Stack>

              <Preview
                columnsAndSeparators={columnsAndSeparators}
                drill={drill}
                query={query}
                stageIndex={stageIndex}
              />
            </>
          )}

          {sourceColumn && (
            <Flex align="center" gap="md" justify="space-between">
              <Button
                leftIcon={<Icon name="add" />}
                p={0}
                variant="subtle"
                onClick={handleAdd}
              >
                {t`Add another column`}
              </Button>

              <Button disabled={!sourceColumn} type="submit" variant="filled">
                {t`Done`}
              </Button>
            </Flex>
          )}
        </Stack>
      </Card>
    </form>
  );
};
