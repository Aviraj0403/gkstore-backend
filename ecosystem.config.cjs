module.exports = {
  apps: [
    {
      name: "restro-backend-5005", // Default instance
      script: "./index.js",
      env: {
        NODE_ENV: "development",
        PORT: 5005,  // Port for default instance
        JWTSECRET: process.env.JWTSECRET,
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
    {
      name: "restro-backend-5006", // Second instance running on port 5006
      script: "./index.js",
      env: {
        NODE_ENV: "development",
        PORT: 5006,  // Port for second instance
        JWTSECRET: process.env.JWTSECRET,
      },
      watch: false,
      instances: 1,
      exec_mode: "cluster",
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
    {
      name: "restro-backend-5007", // Third instance running on port 5007
      script: "./index.js",
      env: {
        NODE_ENV: "development",
        PORT: 5007,  // Port for third instance
        JWTSECRET: process.env.JWTSECRET,
      },
      watch: false,
      instances: 1,
      exec_mode: "cluster",
      log_date_format: "YYYY-MM-DD HH:mm Z",
    },
  ],
};
