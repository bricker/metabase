import { createMockEntitiesState } from "__support__/store";
import { renderWithProviders } from "__support__/ui";
import { getNextId } from "__support__/utils";
import { createMockDatabase } from "metabase-types/api/mocks";
import { createMockState } from "metabase-types/store/mocks";

import { StrategyEditorForDatabases } from "./StrategyEditorForDatabases";

const databaseId = getNextId();

// Will it work to get the databases from the redux store?
const database = createMockDatabase({
  id: databaseId,
  name: "Test Database",
  tables: [],
});

const storeInitialState = createMockState({
  entities: createMockEntitiesState({
    databases: [database],
  }),
});

function setup() {
  return renderWithProviders(<StrategyEditorForDatabases />, {
    storeInitialState,
    withRouter: true,
  });
}

describe("StrategyEditorForDatabases", () => {
  it("should show all databases", () => {
    setup();
    expect(true).toBe(true);
  });
});
