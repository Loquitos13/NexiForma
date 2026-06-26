/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  testEnvironment: "node",
  moduleNameMapper: {
    "^@nexiforma/database$": "<rootDir>/../../../packages/database/generated/prisma-client",
    "^@nexiforma/shared$": "<rootDir>/../../../packages/shared/dist/index.js",
  },
};
