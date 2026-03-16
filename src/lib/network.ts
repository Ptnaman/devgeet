const NETWORK_ERROR_CODE_PATTERN =
  /(network-request-failed|unavailable|deadline-exceeded|failed-precondition)/i;
const NETWORK_ERROR_MESSAGE_PATTERN =
  /(network request failed|failed to fetch|offline|internet connection appears to be offline|timed out|timeout|network error|could not reach|unable to connect)/i;

export const DEFAULT_OFFLINE_MESSAGE =
  "No internet connection. Check your internet and try again.";

const readErrorCode = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return "";
};

const readErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "";
};

export const isNetworkError = (error: unknown) => {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  return (
    NETWORK_ERROR_CODE_PATTERN.test(code) || NETWORK_ERROR_MESSAGE_PATTERN.test(message)
  );
};

export const getActionErrorMessage = ({
  error,
  isConnected,
  fallbackMessage,
  offlineMessage = DEFAULT_OFFLINE_MESSAGE,
}: {
  error: unknown;
  isConnected: boolean;
  fallbackMessage: string;
  offlineMessage?: string;
}) => {
  if (!isConnected || isNetworkError(error)) {
    return offlineMessage;
  }

  const message = readErrorMessage(error);
  return message || fallbackMessage;
};

export const getRequestErrorMessage = ({
  error,
  isConnected,
  onlineMessage,
  offlineMessage = DEFAULT_OFFLINE_MESSAGE,
}: {
  error: unknown;
  isConnected: boolean;
  onlineMessage: string;
  offlineMessage?: string;
}) => {
  if (!isConnected || isNetworkError(error)) {
    return offlineMessage;
  }

  return onlineMessage;
};
