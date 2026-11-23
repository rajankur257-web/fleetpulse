export const Platform = {
  OS: 'android',
  select: (objs: Record<string, any>) => objs.android ?? objs.default,
};

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
};
