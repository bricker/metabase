import { useFormikContext } from "formik";
import { useEffect, useState } from "react";
import { t } from "ttag";
import _ from "underscore";

// BUG: Errors are not displayed on the submit button when the input is invalid
// To trigger an error, enter '1e5'

import type { FormState } from "metabase/forms";
import {
  Form,
  FormRadioGroup,
  FormSubmitButton,
  FormTextInput,
  useFormContext,
} from "metabase/forms";
import { color } from "metabase/lib/colors";
import {
  Button,
  Group,
  Icon,
  Loader,
  Radio,
  Stack,
  Text,
  Title,
} from "metabase/ui";

import type { ModelId, Strat } from "../types";
import { Strategies } from "../types";

export const StrategyForm = ({
  targetId,
  setIsStrategyFormDirty,
}: {
  targetId: ModelId | null;
  setIsStrategyFormDirty: (isDirty: boolean) => void;
}) => {
  const { dirty, values } = useFormikContext<Strat>();
  const selectedStrategyType = values.type;

  const [formState, setFormState] = useState<FormState>({
    status: "idle",
  });

  useEffect(() => {
    if (dirty && formState.status === "fulfilled") {
      setFormState({ status: "idle" });
    }
  }, [dirty, formState.status]);

  useEffect(() => {
    setIsStrategyFormDirty(dirty);
  }, [dirty, setIsStrategyFormDirty]);

  return (
    <Form
      h="100%"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Stack p="lg" spacing="xl" maw="24rem">
        <StrategySelector targetId={targetId} />
        {selectedStrategyType === "ttl" && (
          <>
            <section>
              <Title order={4}>{t`Minimum query duration`}</Title>
              <p>
                {t`Metabase will cache all saved questions with an average query execution time greater than this many seconds.`}
              </p>
              <PositiveNumberInput fieldName="min_duration" />
            </section>
            <section>
              <Title order={4}>{t`Cache time-to-live (TTL) multiplier`}</Title>
              {/* TODO: Add link to example */}
              <p>
                {t`To determine how long each cached result should stick around, we take that query's average execution time and multiply that by what you input here. The result is how many seconds the cache should remain valid for.`}
              </p>
              <PositiveNumberInput fieldName="multiplier" />
            </section>
          </>
        )}
        {selectedStrategyType === "duration" && (
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
      <FormButtons />
    </Form>
  );
};

// <StrategyConfig />
//               Add later
//               <section>
//               <p>
//               {jt`We’ll periodically run ${(
//               <code>select max()</code>
//               )} on the column selected here to check for new results.`}
//               </p>
//               <Select data={columns} />
// TODO: I'm not sure this string translates well
// </section>
// <section>
// <p>{t`Check for new results every...`}</p>
// <Select data={durations} />
// </section>

export const FormButtons = () => {
  const { dirty } = useFormikContext<Strat>();
  const { status } = useFormContext();

  const isRequestPending = status === "pending";
  const [wasRequestRecentlyPending, setWasRequestRecentlyPending] =
    useState(false);

  useEffect(() => {
    if (isRequestPending) {
      setWasRequestRecentlyPending(true);
      const timeout = setTimeout(() => {
        setWasRequestRecentlyPending(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isRequestPending]);

  const shouldShowButtons =
    dirty || isRequestPending || wasRequestRecentlyPending;

  if (!shouldShowButtons) {
    return null;
  }

  return (
    <Group
      style={{
        position: "sticky",
        bottom: 0,
        borderTop: `1px solid ${color("border")}`,
      }}
      p="1rem"
      bg={color("white")}
      spacing="md"
    >
      <Button variant="subtle" type="reset">{t`Discard changes`}</Button>
      <FormSubmitButton
        label={t`Save changes`}
        successLabel={
          <Group spacing="xs">
            <Icon name="check" /> {t`Saved`}
          </Group>
        }
        activeLabel={
          <Group spacing="sm">
            <Loader size="xs" />
            {t`Saving...`}
          </Group>
        }
        variant="filled"
      />
    </Group>
  );
};

export const PositiveNumberInput = ({ fieldName }: { fieldName: string }) => {
  // NOTE: Known bug: on Firefox, if you type invalid input, the error
  // message will be "Required field" instead of "must be a positive number".
  // BUG: if you blank out the input and press save, there is no user feedback
  return (
    <FormTextInput
      name={fieldName}
      type="number"
      min={1}
      styles={{
        input: {
          // This is like `text-align: right` but it's RTL-friendly
          textAlign: "end",
          maxWidth: "3.5rem",
        },
      }}
      autoComplete="off"
    />
  );
};

const StrategySelector = ({ targetId }: { targetId: ModelId | null }) => {
  const { values } = useFormikContext<Strat>();

  const availableStrategies =
    targetId === "root" ? _.omit(Strategies, "inherit") : Strategies;

  return (
    <section>
      <FormRadioGroup
        label={
          <Text lh="1rem">{t`When should cached query results be invalidated?`}</Text>
        }
        name="type"
      >
        <Stack mt="md" spacing="md">
          {_.map(availableStrategies, (option, name) => {
            const optionLabelParts = option.label.split(":");
            // FIXME: This assumes the translation will always punctuate a subtitle with ':'
            const optionLabelFormatted =
              optionLabelParts.length === 1 ? (
                option.label
              ) : (
                <>
                  <strong>{option.label.split(":")[0]}</strong>:
                  {option.label.split(":")[1]}
                </>
              );
            return (
              <Radio
                value={name}
                key={name}
                label={optionLabelFormatted}
                autoFocus={values.type === name}
              />
            );
          })}
        </Stack>
      </FormRadioGroup>
    </section>
  );
};
