import { useCallback } from "react";
import _ from "underscore";

import { color } from "metabase/lib/colors";
import { useDispatch } from "metabase/lib/redux";
import { addUndo } from "metabase/redux/undo";

export const useRequests = () => {
  const dispatch = useDispatch();

  const showSuccessToast = useCallback(async () => {
    dispatch(
      addUndo({
        message: "Updated",
        toastColor: "success",
        dismissButtonColor: color("white"),
      }),
    );
  }, [dispatch]);

  const showErrorToast = useCallback(async () => {
    dispatch(
      addUndo({
        icon: "warning",
        message: "Error",
        toastColor: "error",
        dismissButtonColor: color("white"),
      }),
    );
  }, [dispatch]);

  return { showSuccessToast, showErrorToast };
};
