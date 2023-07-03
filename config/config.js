let config = {
  user_status: {
    1: "approved",
    0: "rejected",
    2: "pending",
  },
  //["user", "admin", "team_leader", "observer"],
  user_role: {
    1: "admin",
    2: "subadmin",
    3: "team_leader",
    4: "observer",
    5: "client",
    6: "user",
  },
  task_status: {
    1: "Active",
    2: "In_Progress",
    3: "QA",
    4: "Completed",
    5: "Backlogs",
    6: "Confirmed",
  },
  project_status: {
    1: "ACTIVE",
    2: "HOLD",
    3: "COMPLETED",
  },
};

module.exports = config;
