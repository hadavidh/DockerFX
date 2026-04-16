module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script"
  },
  ignorePatterns: [
    "node_modules/",
    "coverage/",
    "dist/",
    "build/"
  ],
  rules: {
    "no-empty": "off",
    "no-unused-vars": "off",
    "no-undef": "off",
    "no-console": "off"
  }
};