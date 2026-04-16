module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    "coverage/"
  ],
  rules: {
    "no-empty": "off",
    "no-unused-vars": "off",
    "no-undef": "off",
    "no-console": "off"
  }
};