/* eslint-disable react/prop-types */
import { Component } from "react";
import { connect } from "react-redux";
import { t } from "ttag";
import _ from "underscore";

import MetricItem from "metabase/admin/datamodel/components/MetricItem";
import FilteredToUrlTable from "metabase/admin/datamodel/hoc/FilteredToUrlTable";
import Button from "metabase/core/components/Button";
import Link from "metabase/core/components/Link";
import AdminS from "metabase/css/admin.module.css";
import Metrics from "metabase/entities/metrics";

class MetricListAppInner extends Component {
  render() {
    const { metrics, tableSelector, setArchived } = this.props;

    return (
      <div className="px3 pb2">
        <div className="flex py2">
          {tableSelector}
          <Link to="/admin/datamodel/metric/create" className="ml-auto">
            <Button primary>{t`New metric`}</Button>
          </Link>
        </div>
        <table className={AdminS.AdminTable}>
          <thead className="text-bold">
            <tr>
              <th style={{ minWidth: "320px" }}>{t`Name`}</th>
              <th className="full">{t`Definition`}</th>
              <th>{t`Actions`}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(metric => (
              <MetricItem
                key={metric.id}
                onRetire={() => setArchived(metric, true)}
                metric={metric}
              />
            ))}
          </tbody>
        </table>
        {metrics.length === 0 && (
          <div className="flex layout-centered m4 text-medium">
            {t`Create metrics to add them to the Summarize dropdown in the query builder`}
          </div>
        )}
      </div>
    );
  }
}

const MetricListApp = _.compose(
  Metrics.loadList(),
  FilteredToUrlTable("metrics"),
  connect(null, { setArchived: Metrics.actions.setArchived }),
)(MetricListAppInner);

export default MetricListApp;
