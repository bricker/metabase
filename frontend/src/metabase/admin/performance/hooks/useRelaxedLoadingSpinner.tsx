import { useEffect, useState } from "react";

/**
 * A loading spinner that doesn't appear right away but waits a bit first
 * @see https://metaboat.slack.com/archives/C02H619CJ8K/p1709558533499399
 */
export const useRelaxedLoadingSpinner = () => {
  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setShowLoadingSpinner(true);
    }, 300);
  }, []);

  return showLoadingSpinner;
};
