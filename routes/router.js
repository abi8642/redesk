const express = require("express");
const router = express.Router();

const {
  signupValidation,
  loginValidation,
} = require("../middleware/validation");
const { requiredAuth } = require("../middleware/requiredAuth");
const {
  signup,
  signin,
  signout,
  getUser,
  getLoginUser,
  userEdit,
  userApproveOrReject,
  forgetPassword,
  getTeamLeaderList,
  changeUserRoles,
  signinwithorgs,
  signupwithorgs,
  getEmployeeList,
  allUsers,
  getObserversList,
  createClient,
  getClient,
  createObserver,
  getObserver,
  createSubAdmin,
  getSubadmin,
  verifyOtp,
  changePassword,
  allUserFromOrgs,
  sendOtp,
  requestToken,
} = require("../controllers/userController");
const {
  createTask,
  getTask,
  editTask,
  closeTask,
  reminderTask,
  getTaskByProject,
  getTaskById,
  changeTaskStatus,
  getTaskByUser,
  getTaskCount,
  getTaskArray,
  addTaskComment,
  deleteTask,
} = require("../controllers/taskController");
const {
  createProject,
  getProject,
  editProject,
  getProjectById,
  getTaskCountByProject,
  getTaskByStatus,
  assignProject,
  assignTeamLeader,
  getProjectMembers,
  addProjectAttachment,
  changeProjectStatus,
  deleteProject,
  deleteProjectAttachment,
} = require("../controllers/projectController");
const { createRole, getRole } = require("../controllers/roleController");
const {
  createComment,
  getComment,
} = require("../controllers/commentController");
const { getNotification } = require("../controllers/notificationController");
const { resetPassword } = require("../services/passwordReset");
const { createPayroll } = require("../controllers/payrollController");
const {
  createOrganisation,
  checkSubDomain,
  sendInviteFromOrganisation,
  getOrganisationList,
  verifyOrganisation,
  getDashboardDetails,
  sendInviteFromCSV,
  verifyEmailInvite,
  createCategory,
  editCategory,
  allCategories,
  createOrganisationfromEmail,
} = require("../controllers/organisationController");
const {
  allMessages,
  sendMessage,
} = require("../controllers/messageController");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  removeFromGroup,
  addToGroup,
} = require("../controllers/chatContoller");

const { query, param, body } = require("express-validator");
const {
  folderList,
  createFolder,
  uploadFile,
  fileList,
  requestFile,
} = require("../controllers/fileSystemController");

//Organisation
router.post("/createOrganisation", createOrganisation);
router.post("/createOrganisationfromEmail", createOrganisationfromEmail);
router.post("/checkSubDomain", checkSubDomain);
router.get("/verifyOrganisation", verifyOrganisation);
router.get("/getOrganisationList", getOrganisationList);
router.post(
  "/sendInvite",
  requiredAuth(["admin", "subadmin", "team_leader"]),
  sendInviteFromOrganisation
);
router.post(
  "/sendInviteFromCSV",
  requiredAuth(["admin", "subadmin", "team_leader"]),
  sendInviteFromCSV
);
router.post("/verifyEmailInvite", verifyEmailInvite);
router.get("/getdashboarddetails", requiredAuth(), getDashboardDetails);

router.post("/createCategory", requiredAuth(), createCategory);
router.post("/editCategory", requiredAuth(), editCategory);
router.get("/categoryList", requiredAuth(), allCategories);

// router.get("/",)

router.post("/sendOtp", sendOtp);
router.post("/verifyOtp", verifyOtp);
router.post("/requestToken", requestToken);

//user create
router.post("/signup", signupValidation, signup);
router.post("/signupwithorgs", signupValidation, signupwithorgs);
router.post("/signin", loginValidation, signin);
router.post("/signinwithorgs", loginValidation, signinwithorgs);
router.get("/loggedInUser", requiredAuth(), getLoginUser);
router.get("/signout", requiredAuth(), signout);

router.get("/allUserFromOrgs", requiredAuth(), allUserFromOrgs);
router.get("/userList", requiredAuth(["admin", "subadmin"]), getUser);
router.get("/teamLeader", requiredAuth(), getTeamLeaderList);
// router.get("/observerlist", requiredAuth(), getObserversList);
router.get("/employeeList", requiredAuth(), getEmployeeList);
router.put("/editUser", requiredAuth(), userEdit);
router.post(
  "/changeUserRoles/:id",
  requiredAuth(["admin", "subadmin"]),
  changeUserRoles
);
router.post(
  "/userApproveOrReject/:id",
  requiredAuth(["admin", "subadmin"]),
  userApproveOrReject
);

router.post(
  "/createobserver",
  requiredAuth(["admin", "subadmin"]),
  createObserver
);
router.get("/observerList", requiredAuth(), getObserver);
router.put(
  "/editObserver/:id",
  requiredAuth(),
  param("id").notEmpty(),
  userEdit
);

router.post(
  "/createsubadmin",
  requiredAuth(["admin", "subadmin"]),
  createSubAdmin
);
router.get("/subadminList", requiredAuth(), getSubadmin);
router.put(
  "/editsubadmin/:id",
  requiredAuth(),
  param("id").notEmpty(),
  userEdit
);

router.post("/createclient", requiredAuth(["admin", "subadmin"]), createClient);
router.get("/clientList", requiredAuth(), getClient);
router.put("/editClient/:id", requiredAuth(), param("id").notEmpty(), userEdit);

//task create
router.post("/Task", requiredAuth(), createTask);
router.get("/taskList", requiredAuth(), getTask);
router.get("/taskListByProject/:id", requiredAuth(), getTaskByProject);
router.get("/taskArray", requiredAuth(), getTaskArray);
router.get("/taskArrayByProject/:id", requiredAuth(), getTaskArray);
router.delete("/task/:id", requiredAuth(), deleteTask);

router.get("/taskListByUser", requiredAuth(), getTaskByUser);
router.get("/task/:id", requiredAuth(), getTaskById);
router.put("/taskEdit/:id", requiredAuth(), editTask);
router.put("/taskClose/:id", requiredAuth(), closeTask);
router.get("/taskReminder/:id", requiredAuth(), reminderTask);
router.get("/taskcount", requiredAuth(), getTaskCount);
router.post("/changeTaskStatus/:id", requiredAuth(), changeTaskStatus);
router.post(
  "/addTaskComment",
  requiredAuth(),
  body("id").notEmpty(),
  // body("comment").notEmpty(),
  addTaskComment
);

//create project
router.post(
  "/project",
  requiredAuth(["admin", "subadmin", "team_leader"]),
  createProject
);
router.get("/projectMembers/:id", requiredAuth(), getProjectMembers);
router.post("/addProjectAttachment/:id", requiredAuth(), addProjectAttachment);
router.post(
  "/deleteprojectAttachment/:id",
  requiredAuth(),
  deleteProjectAttachment
);
router.get("/projectList", requiredAuth(), getProject);
router.put("/projectEdit/:id", requiredAuth(), editProject);
router.delete("/project/:id", requiredAuth(), deleteProject);
router.get("/projectDetails/:id", requiredAuth(), getProjectById);
router.get("/projectTaskCount/:id", requiredAuth(), getTaskCountByProject);
router.get("/projecttaskListByStatus", requiredAuth(), getTaskByStatus);
router.post("/changeProjectStatus/:id", requiredAuth(), changeProjectStatus);
router.put(
  "/assignProject/:id",
  requiredAuth(["admin", "subadmin", "team_leader"]),
  assignProject
);
router.put(
  "/assignTeamLeader/:id",
  requiredAuth(["admin", "subadmin"]),
  assignTeamLeader
);

//create role
router.post("/role", requiredAuth(), createRole);
router.get("/roleList", requiredAuth(), getRole);

// comment
router.post("/comment", requiredAuth(), createComment);
router.get("/comment/:task_id", requiredAuth(), getComment);

// Notification route
router.get("/notification", requiredAuth(), getNotification);

// forget password route
router.post("/forgetPassword", forgetPassword);
router.post("/changePassword", requiredAuth(), changePassword);
// router.post("/verifyOtp", verifyOtp);

// api for reset password
router.post("/resetPassword/:id", resetPassword);

// payroll routes
router.post("/payroll", requiredAuth(), createPayroll);

//Chat routes
router.get("/user", requiredAuth(), allUsers);
router.get("/message/:chatId", requiredAuth(), allMessages);
router.post("/message/", requiredAuth(), sendMessage);
router.post("/chat/", requiredAuth(), accessChat);
router.get("/chat/", requiredAuth(), fetchChats);
router.post("/group", requiredAuth(), createGroupChat);
router.put("/rename", requiredAuth(), renameGroup);
router.put("/groupremove", requiredAuth(), removeFromGroup);
router.put("/groupadd", requiredAuth(), addToGroup);

//fileSystem

// router.get("/upload", requiredAuth(), uploadFile);
router.post("/createFolder", requiredAuth(), createFolder);
router.get("/folderList", requiredAuth(), folderList);
router.get("/fileList", requiredAuth(), fileList);
router.post("/upload", requiredAuth(), uploadFile);

router.post("/requestFile", requiredAuth(), requestFile);
module.exports = router;
