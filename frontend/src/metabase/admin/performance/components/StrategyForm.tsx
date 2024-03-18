import { useFormikContext } from "formik";
import { t } from "ttag";
import _ from "underscore";

// BUG: the confirmation modal is no longer working. time to add some tests so i can catch regressions like this!

import {
  Form,
  FormRadioGroup,
  FormSubmitButton,
  FormTextInput,
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
  isRequestPending,
  wasRequestRecentlyPending,
  targetId,
}: {
  isRequestPending: boolean;
  wasRequestRecentlyPending: boolean;
  targetId: ModelId | null;
}) => {
  const { values } = useFormikContext<Strat>();
  const selectedStrategyType = values.type;

  return (
    <Form
      h="100%"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Stack p="lg" spacing="xl">
        <StrategySelector targetId={targetId} />
        {selectedStrategyType === "ttl" && (
          <>
            <section>
              <Title order={4}>{t`Minimum query duration`}</Title>
              <p>
                {t`Metabase will cache all saved questions with an average query execution time longer than this many seconds:`}
              </p>
              <PositiveNumberInput fieldName="min_duration" />
            </section>
            <section>
              <Title order={4}>{t`Cache time-to-live (TTL) multiplier`}</Title>
              <p>
                {t`To determine how long each saved question's cached result should stick around, we take the query's average execution time and multiply that by whatever you input here. So if a query takes on average 2 minutes to run, and you input 10 for your multiplier, its cache entry will persist for 20 minutes.`}
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
      {(useFormikContext().dirty ||
        isRequestPending ||
        wasRequestRecentlyPending) && <FormButtons />}
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
  const { values } = useFormikContext();

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
      <Button
        variant="subtle"
        onClick={() => {
          // FIXME:
          alert("not yet implemented");
        }}
      >{t`Discard changes`}</Button>
      <FormSubmitButton
        // Ensure that the button is recreated when the form becomes dirty
        key={JSON.stringify(values)}
        label={t`Save changes`}
        successLabel={
          <Group spacing="xs">
            <Icon name="check" /> {t`Saved`}
          </Group>
        }
        activeLabel={
          <Group spacing="sm">
            <Loader style={{ filter: "brightness(300%)" }} size="xs" />
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
          {_.map(availableStrategies, (option, name) => (
            <Radio
              value={name}
              key={name}
              label={option.label}
              autoFocus={values.type === name}
            />
          ))}
        </Stack>
      </FormRadioGroup>
    </section>
  );
};
