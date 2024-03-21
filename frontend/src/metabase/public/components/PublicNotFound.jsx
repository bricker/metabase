import { t } from "ttag";

import CS from "metabase/css/core/index.css";
import { NoRowsError } from "metabase/query_builder/components/errors/NowRowsError";

import EmbedFrame from "./EmbedFrame";

const PublicNotFound = () => (
  <EmbedFrame className={CS.spread}>
    <div className="flex layout-centered flex-full flex-column">
      <NoRowsError />
      <div className="mt1 h4 sm-h3 md-h2 text-bold">{t`Not found`}</div>
    </div>
  </EmbedFrame>
);

export default PublicNotFound;
