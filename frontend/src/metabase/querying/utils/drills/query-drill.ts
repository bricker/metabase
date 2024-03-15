import type { ClickAction } from "metabase/visualizations/types";
import * as Lib from "metabase-lib";
import type Question from "metabase-lib/v1/Question";

import { DRILLS } from "./constants";

const EXCLUDED_DRILLS: Lib.DrillThruType[] = [
  "drill-thru/column-extract",
  "drill-thru/combine-columns",
];

export function queryDrill(
  question: Question,
  clicked: Lib.ClickObject,
): ClickAction[] {
  const query = question.query();
  const stageIndex = -1;
  const drills = Lib.availableDrillThrus(
    query,
    stageIndex,
    clicked.column,
    clicked.value,
    clicked.data,
    clicked.dimensions,
  ).filter(drill => {
    const info = Lib.displayInfo(query, stageIndex, drill);

    if (clicked.plus) {
      return EXCLUDED_DRILLS.includes(info.type);
    } else {
      return !EXCLUDED_DRILLS.includes(info.type);
    }
  });

  const extractDrill = drills.find(drill => {
    const info = Lib.displayInfo(query, stageIndex, drill);
    return info.type === "drill-thru/column-extract";
  });

  const applyDrill = (drill: Lib.DrillThru, ...args: unknown[]) => {
    const newQuery = Lib.drillThru(query, stageIndex, drill, ...args);
    return question.setQuery(newQuery);
  };

  const alldrills = [...drills, extractDrill];
  return alldrills.filter(Boolean).flatMap((drill, index) => {
    const drillInfo = Lib.displayInfo(
      query,
      stageIndex,
      drill,
      clicked.plus && drill === extractDrill && index === alldrills.length - 1,
    );
    const drillHandler = DRILLS[drillInfo.type];
    return drillHandler({
      question,
      query,
      stageIndex,
      drill,
      drillInfo,
      clicked,
      applyDrill,
    });
  });
}
