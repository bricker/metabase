import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { ContinuousDomain } from "metabase/visualizations/shared/types/scale";
import type { TimeSeriesXAxisModel } from "../model/types";
import {
  computeTimeseriesTicksInterval,
  getTimeSeriesIntervalDuration,
} from "../utils/timeseries";

export const getTicksOptions = (
  xAxisModel: TimeSeriesXAxisModel,
  chartWidth: number,
): any => {
  const { range } = xAxisModel;

  let formatter = xAxisModel.formatter;
  let minInterval;
  let maxInterval;

  const dataInterval = xAxisModel.interval;
  const xDomain: ContinuousDomain = [range[0].valueOf(), range[1].valueOf()];
  const paddedRange = [
    xDomain[0] - getTimeSeriesIntervalDuration(xAxisModel.interval) / 2,
    xDomain[1] + getTimeSeriesIntervalDuration(xAxisModel.interval) / 2,
  ];
  const isSingleItem = xDomain[0] === xDomain[1];

  const computedInterval = computeTimeseriesTicksInterval(
    xDomain,
    xAxisModel.interval,
    chartWidth,
    xAxisModel.formatter,
  );

  if (dataInterval.unit === "week" && computedInterval.unit !== "week") {
    formatter = value => {
      return xAxisModel.formatter(value, "month");
    };
  }

  const paddedMin = dayjs(paddedRange[0]);
  const paddedMax = dayjs(paddedRange[1]);
  const isWithinRange = (date: Dayjs) => {
    return (
      date.isSame(paddedMin) ||
      date.isSame(paddedMax) ||
      (date.isAfter(paddedMin) && date.isBefore(paddedMax))
    );
  };

  let canRender: (value: Dayjs) => boolean = date => isWithinRange(date);

  if (computedInterval.unit === "week") {
    const startOfWeek = range[0].day();
    canRender = (date: Dayjs) =>
      isWithinRange(date) && date.day() === startOfWeek;
    const effectiveTicksUnit = "day";
    maxInterval = getTimeSeriesIntervalDuration({
      count: 1,
      unit: effectiveTicksUnit,
    });
  }

  if (
    !isSingleItem &&
    computedInterval.unit === "month" &&
    computedInterval.count === 3
  ) {
    const effectiveTicksUnit = "month";
    canRender = (date: Dayjs) =>
      isWithinRange(date) && date.startOf("quarter").isSame(date, "month");
    maxInterval = getTimeSeriesIntervalDuration({
      count: 1,
      unit: effectiveTicksUnit,
    });
  }

  if (!maxInterval) {
    minInterval = getTimeSeriesIntervalDuration({
      count: computedInterval.count,
      unit: computedInterval.unit,
    });
  }

  return {
    formatter,
    minInterval,
    maxInterval,
    canRender,
    paddedRange,
  };
};
