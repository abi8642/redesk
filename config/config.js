let config = {
  user_status: {
    1: "approved",
    0: "rejected",
    2: "pending",
  },
  //["user", "admin", "team_leader", "observer"],
  user_role: {
    0: "user",
    1: "team_leader",
    2: "observer",
  },
  task_status: {
    1: "ACTIVE",
    2: "In_Progress",
    3: "QA",
    4: "Completed",
    5: "Backlogs",
  },
  project_status: {
    1: "ACTIVE",
    2: "HOLD",
    3: "COMPLETED",
  },
};

module.exports = config;
