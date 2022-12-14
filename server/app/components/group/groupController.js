const groupService = require("./groupService");
const userService = require("../user/userService");
const memberService = require("../member/memberService");
const { result } = require("lodash");
const createError = require("http-errors");

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.listGroup = async (req, res, next) => {
  const userId = req.decoded.user.id;
  const groupList = await groupService.listGroupOfUser(userId);
  for (let x in groupList) {
    groupList[x].owner = await groupService.getGroupOwner(groupList[x].id);
  }
  return res.status(200).send({ groupList: groupList });
};

exports.listMemberIdOfGroup = async (req, res) => {
  const groupId = req.body.group_id;
  const memberOfGroup = await groupService.listMemberOfGroup(groupId);
  return res.status(200).json({ memberOfGroup });
};

exports.createGroup = async (req, res, next) => {
  const { groupName } = req.body;
  const user = await userService.findById(req.decoded.user.id);
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  const group = await groupService.create(groupName);
  await group.addUser(user, { through: { role: "Owner" } });
  const result = await groupService.findGroupWithMember(group.id);
  return res
    .status(200)
    .send({ group: result, message: "Create successfully!" });
};

exports.deleteGroup = async (req, res, next) => {
  const userId = req.decoded.user.id;
  const groupId = req.params["id"];
  const member = await memberService.findMemberInGroup(groupId, userId);
  if (!member) {
    return res.status(404).send({ message: "Member not found" });
  }
  if (!(member.role === "Owner")) {
    return res.status(400).send({ message: "Cannot delete group" });
  }
  await groupService.delete(groupId);
  return res.status(200).send({ message: "Delete successfully!" });
};

exports.getMemberOfGroup = async (req, res, next) => {
  const groupId = req.params["id"];
  const group = await groupService.findGroupWithMember(groupId);
  return res.status(200).send({ group: group });
};

exports.createInvitationLink = async (req, res, next) => {
  const groupId = req.query["group"];
  const group = await groupService.findById(groupId);
  if (!group) {
    return res.status(404).send({ message: "Group not found" });
  }
  const invitationLink =
    process.env.DOMAIN +
    "/group/invite?group=" +
    groupId +
    "&invitationString=" +
    group.invitationString;
  return res
    .status(200)
    .send({ link: invitationLink, message: "Create successfully!" });
};

exports.inviteToGroup = async (req, res, next) => {
  const { groupId, email } = req.body;
  const group = await groupService.findById(groupId);
  if (!group) {
    return res.status(404).send({ message: "Group not found" });
  }
  const user = await userService.findByEmail(email);
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  const domain = process.env.DOMAIN;

  //send invitation link
  const msg = {
    to: user.email, // Change to your recipient
    from: "tdhtrung19@clc.fitus.edu.vn", // Change to your verified sender
    subject: "Group invitation",
    text: `Thanks for joining ${group.groupName} group!`,
    html: `<h1>Thanks for joining ${group.groupName} group!</h1>
        <a href="${domain}/group/invite?group=${group.id}&invitationString=${group.invitationString}">Activate now</a>`,
  };
  sgMail
    .send(msg)
    .then(() => {
      console.log(domain);
    })
    .catch((error) => {
      console.error(error);
      return res.status(400).send({ message: "Error sending mail!" });
    });
  return res.status(200).send({ message: "Email was sent!" });
};

exports.invite = async (req, res, next) => {
  const groupId = req.query["group"];
  const invitationString = req.query["invitationString"];
  const userId = req.decoded.user.id;
  console.log(invitationString);
  const group = await groupService.findById(groupId);
  if (!group) {
    return res.status(404).send({ message: "Group not found" });
  }

  const result = await groupService.invite(groupId, invitationString);

  if (result) {
    const user = await userService.findById(userId);
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    await group.addUser(user, { through: { role: "Member" } });
    return res
      .status(200)
      .send({ error: false, message: "Join group successfully!" });
  } else {
    return res.status(400).send({ error: true, message: "Join group failed" });
  }
};
