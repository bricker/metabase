import { useCallback, useEffect, useState } from "react";
import { push } from "react-router-redux";
import { t } from "ttag";
import type { SearchResult } from "metabase-types/api";
import {
  useCollectionListQuery,
  useDatabaseListQuery,
  useSearchListQuery,
} from "metabase/common/hooks";
import { useDispatch } from "metabase/lib/redux";
import { Flex, Icon, Text } from "metabase/ui";

import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";
import Link from "metabase/core/components/Link";
import { PLUGIN_CONTENT_VERIFICATION } from "metabase/plugins";
import type { ActualModelFilters, ModelFilterName } from "../utils";
import { isValidBrowseTab, type BrowseTabId } from "../utils";
import {
  BrowseAppRoot,
  BrowseContainer,
  BrowseDataHeader,
  BrowseTab,
  BrowseTabs,
  BrowseTabsList,
  BrowseTabsPanel,
} from "./BrowseApp.styled";
import { BrowseDatabases } from "./BrowseDatabases";
import { BrowseHeaderIconContainer } from "./BrowseHeader.styled";
import { BrowseModels } from "./BrowseModels";
import _ from "underscore";

export const BrowseApp = ({
  tab,
  children,
}: {
  tab: BrowseTabId;
  children?: React.ReactNode;
}) => {
  const dispatch = useDispatch();
  const modelsResult = useSearchListQuery<SearchResult>({
    query: {
      models: ["dataset"],
      filter_items_in_personal_collection: "exclude",
    },
  });
  // TODO: Tell the /api/search backend to send a little more data so we can get the collection icon. We just need the type "instance-analytics" to be hydrated
  const databasesResult = useDatabaseListQuery();

  useEffect(() => {
    if (isValidBrowseTab(tab)) {
      localStorage.setItem("defaultBrowseTab", tab);
    }
  }, [tab]);

  const availableModelFilters =
    PLUGIN_CONTENT_VERIFICATION.availableModelFilters;

  const getInitialModelFilters = useCallback(() => {
    return _.reduce(
      availableModelFilters,
      (acc, filter, filterName) => {
        const storedFilterStatus = localStorage.getItem(
          `browseFilters.${filterName}`,
        );
        const shouldFilterBeActive =
          storedFilterStatus === null
            ? filter.activeByDefault
            : storedFilterStatus === "on";
        return {
          ...acc,
          [filterName]: shouldFilterBeActive,
        };
      },
      {},
    );
  }, [availableModelFilters]);

  const [actualModelFilters, setActualModelFilters] =
    useState<ActualModelFilters>(getInitialModelFilters);
  const { data: unfilteredModels = [] } = modelsResult;

  const [filteredModels, setFilteredModels] = useState(modelsResult.data);

  useEffect(() => {
    const filteredModels = _.reduce(
      actualModelFilters,
      (acc, shouldFilterBeActive, filterName) =>
        shouldFilterBeActive
          ? acc.filter(availableModelFilters[filterName].predicate)
          : acc,
      unfilteredModels,
    );
    setFilteredModels(filteredModels);
  }, [unfilteredModels, actualModelFilters]);

  const filteredModelsResult = { ...modelsResult, data: filteredModels };

  const handleModelFilterChange = useCallback(
    (modelFilterName: ModelFilterName, active: boolean) => {
      localStorage.setItem(
        `browseFilters.${modelFilterName}`,
        active ? "on" : "off",
      );
      setActualModelFilters((prev: ActualModelFilters) => {
        return { ...prev, [modelFilterName]: active };
      });
    },
    [setActualModelFilters],
  );

  if (!isValidBrowseTab(tab)) {
    return <LoadingAndErrorWrapper error />;
  }

  return (
    <BrowseAppRoot data-testid="browse-app">
      <BrowseContainer>
        <BrowseDataHeader>
          <Flex maw="64rem" m="0 auto" w="100%" align="center">
            <h2>{t`Browse data`}</h2>
          </Flex>
        </BrowseDataHeader>
        <BrowseTabs
          value={tab}
          onTabChange={value => {
            if (isValidBrowseTab(value)) {
              dispatch(push(`/browse/${value}`));
            }
          }}
        >
          <BrowseTabsList>
            <Flex maw="64rem" m="0 auto" w="100%" align="center">
              <BrowseTab key={"models"} value={"models"}>
                {t`Models`}
              </BrowseTab>
              <BrowseTab key={"databases"} value={"databases"}>
                {t`Databases`}
              </BrowseTab>
              {tab === "models" && (
                <PLUGIN_CONTENT_VERIFICATION.BrowseFilterControls
                  actualModelFilters={actualModelFilters}
                  handleModelFilterChange={handleModelFilterChange}
                />
              )}
              {tab === "databases" && <LearnAboutDataLink />}
            </Flex>
          </BrowseTabsList>
          <BrowseTabsPanel key={tab} value={tab}>
            <Flex
              maw="64rem"
              direction="column"
              m="0 auto"
              w="100%"
              align="center"
            >
              <BrowseTabContent
                tab={tab}
                modelsResult={filteredModelsResult}
                databasesResult={databasesResult}
                filters={filters}
                // TODO: Perhaps filter the models up here, to keep BrowseModels dumber
              >
                {children}
              </BrowseTabContent>
            </Flex>
          </BrowseTabsPanel>
        </BrowseTabs>
      </BrowseContainer>
    </BrowseAppRoot>
  );
};

const BrowseTabContent = ({
  tab,
  children,
  modelsResult,
  collectionsResult,
  databasesResult,
  filters,
}: {
  tab: BrowseTabId;
  children?: React.ReactNode;
  modelsResult: ReturnType<typeof useSearchListQuery<SearchResult>>;
  collectionsResult: ReturnType<typeof useCollectionListQuery>;
  databasesResult: ReturnType<typeof useDatabaseListQuery>;
  filters: BrowseFilters;
}) => {
  if (children) {
    return <>{children}</>;
  }
  if (tab === "models") {
    return (
      <BrowseModels
        modelsResult={modelsResult}
        collectionsResult={collectionsResult}
        filters={filters}
      />
    );
  } else {
    return <BrowseDatabases databasesResult={databasesResult} />;
  }
};

const LearnAboutDataLink = () => (
  <Flex ml="auto" justify="right" style={{ flexBasis: "40.0%" }}>
    <Link to="reference">
      <BrowseHeaderIconContainer>
        <Icon size={14} name="reference" />
        <Text size="md" lh="1" fw="bold" ml=".5rem" c="inherit">
          {t`Learn about our data`}
        </Text>
      </BrowseHeaderIconContainer>
    </Link>
  </Flex>
);
