type BuyerBoardLogLevel = "info" | "warn" | "error";

function getLogMethod(level: BuyerBoardLogLevel) {
  if (level === "info") {
    return console.info;
  }

  if (level === "warn") {
    return console.warn;
  }

  return console.error;
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

export function logBuyerBoardEvent(
  level: BuyerBoardLogLevel,
  event: string,
  context: Record<string, unknown> = {},
) {
  const log = getLogMethod(level);

  log(`[BuyerBoard:${event}]`, {
    at: new Date().toISOString(),
    ...context,
  });
}
