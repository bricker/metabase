import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper";

import { useRelaxedLoadingSpinner } from "./useRelaxedLoadingSpinner";

export const useNoData = (error: any, loading: boolean) => {
  const showLoadingSpinner = useRelaxedLoadingSpinner();

  if (error || loading) {
    return showLoadingSpinner ? (
      <LoadingAndErrorWrapper error={error} loading={loading} />
    ) : (
      <></>
    );
  }

  return null;
};
