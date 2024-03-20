import { t } from "ttag";
import dayjs from "dayjs";
import type { RawSeries, RowValue } from "metabase-types/api";
import type {
  ComputedVisualizationSettings,
  RenderingContext,
} from "metabase/visualizations/types";
import type {
  ChartDataset,
  DateRange,
  DimensionModel,
  Extent,
  TimeSeriesXAxisModel,
  WaterfallXAxisModel,
} from "metabase/visualizations/echarts/cartesian/model/types";

import { getXAxisModel } from "../../model/axis";
import { isNumericAxis, isTimeSeriesAxis } from "../../model/guards";
import { tryGetDate } from "../../utils/timeseries";

const getTotalTimeSeriesXValue = ({
  interval,
  range,
}: TimeSeriesXAxisModel) => {
  const [, lastDate] = range;
  const { unit, count } = interval;
  return lastDate.add(count, unit).toISOString();
};

export const getWaterfallXAxisModel = (
  dimensionModel: DimensionModel,
  rawSeries: RawSeries,
  dataset: ChartDataset,
  settings: ComputedVisualizationSettings,
  renderingContext: RenderingContext,
): WaterfallXAxisModel => {
  const xAxisModel = getXAxisModel(
    dimensionModel,
    rawSeries,
    dataset,
    settings,
    renderingContext,
  );

  const hasTotal = !!settings["waterfall.show_total"];
  let totalXValue: RowValue | undefined = hasTotal ? t`Total` : undefined;
  let extent: Extent | undefined = isNumericAxis(xAxisModel)
    ? xAxisModel.extent
    : undefined;
  let range: DateRange | undefined = isTimeSeriesAxis(xAxisModel)
    ? xAxisModel.range
    : undefined;

  if (hasTotal) {
    if (isTimeSeriesAxis(xAxisModel)) {
      totalXValue = getTotalTimeSeriesXValue(xAxisModel);
      range = [xAxisModel.range[0], dayjs(totalXValue)];
    } else if (isNumericAxis(xAxisModel)) {
      totalXValue = xAxisModel.extent[1] + xAxisModel.interval;
      extent = [xAxisModel.extent[0], totalXValue];
    }
  }

  const waterfallFormatter = (valueRaw: RowValue) => {
    if (typeof totalXValue === "undefined" || typeof valueRaw === "boolean") {
      return xAxisModel.formatter(valueRaw);
    }

    if (isNumericAxis(xAxisModel)) {
      if (valueRaw === totalXValue) {
        return t`Total`;
      }
    } else if (isTimeSeriesAxis(xAxisModel)) {
      const dateValue = dayjs(valueRaw);

      if (dateValue.isSame(tryGetDate(totalXValue), xAxisModel.interval.unit)) {
        return t`Total`;
      }
    }
    return xAxisModel.formatter(valueRaw);
  };

  const waterfallAxisModel = {
    ...xAxisModel,
    formatter: waterfallFormatter,
    totalXValue,
  };

  if (extent && isNumericAxis(waterfallAxisModel)) {
    return {
      ...waterfallAxisModel,
      extent,
    };
  }

  if (range && isTimeSeriesAxis(waterfallAxisModel)) {
    return {
      ...waterfallAxisModel,
      range,
      intervalsCount: waterfallAxisModel.intervalsCount + 1,
    };
  }

  return waterfallAxisModel;
};
