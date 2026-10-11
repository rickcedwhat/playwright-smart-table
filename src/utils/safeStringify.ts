/** JSON.stringify for debug logs: functions become "[Function]" and cycles don't throw. */
export const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj, (_key: string, value: any) => {
      if (typeof value === 'function') {
        return '[Function]';
      }
      return value;
    });
  } catch (e) {
    return '[unserializable]';
  }
};
