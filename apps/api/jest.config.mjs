const project = (name) => ({
  displayName: name,
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [`<rootDir>/.test-build/${name}/**/*.spec.js`],
  transform: {},
  testTimeout: 10000,
  clearMocks: true,
});

export default { projects: [project('integration'), project('unit')] };
