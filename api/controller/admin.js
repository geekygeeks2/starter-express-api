const moment = require("moment-timezone");
const fast2sms = require("fast-two-sms");
const mongoose = require("mongoose");
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;
const URL = process.env.MONGO_LOCAL_CONN_URL;
const { userModel } = require("../../models/user");
const {roleModel} = require("../../models/role")
const { cronjobModel } = require("../../models/cronjob");
const { FundingSource } = require("../../models/fundingSource");
const { AuthToken } = require("../../models/authtoken");
const { ObjectId } = require("mongodb");
const {
  getAllActiveRoi,
  withDrawalBalance,
} = require("../../util/income");

const authorization = process.env.SMS_API;

module.exports = {
  getAllUsers: async (req, res) => {
    try {
      const searchStr= req.query
      let searchParam={}
       if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
         searchParam={
          $or:[
            {'userInfo.roleName': new RegExp(searchStr, 'i')},
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber2': new RegExp(searchStr, 'i')},
            {'userInfo.aadharNumber':new RegExp(searchStr, 'i')},
            {'userInfo.userId':new RegExp(searchStr, 'i')}
          ]
        }
      }
    
      const users = await userModel.find({
        $and: [ { deleted: false },searchParam]
      });
      return res.status(200).json({
        success: true,
        users,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "User not found.",
        error: err.message,
      });
    }
  },
  getAllStudents: async (req, res) => {
    try {

      const searchStr= req.body.searchStr
      let searchParam={}
      let classParam={}
       if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
         searchParam={
          $or:[
            {'userInfo.roleName': new RegExp(searchStr, 'i')},
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber2': new RegExp(searchStr, 'i')},
            {'userInfo.aadharNumber':new RegExp(searchStr, 'i')},
            {'userInfo.userId':new RegExp(searchStr, 'i')}
          ]
        }
      }

      if(req.body.selectedClass){
        classParam={'userInfo.class':req.body.selectedClass}
      }
      const users = await userModel.find({
        $and: [
          { deleted: false },
          {
            'userInfo.roleName':'STUDENT'
          },
          searchParam,
          classParam
        ],
      });
      return res.status(200).json({
        success: true,
        users,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Student not found.",
        error: err.message,
      });
    }
  },
  deleteUser: async (req, res) => {
    try {
     await userModel.findOneAndUpdate({_id:req.params.id},{deleted: true, modified:new Date()});
      return res.status(200).json({
        success: true,
        message: "Deleted successfully."
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "user not found.",
        error: err.message,
      });
    }
  },

  updateUserById: async (req, res) => {
    try {

      if(req.body.roleUpdate){
          const newRoleName = req.body.newRoleName
          delete req.body.updateRole
          delete req.body.newRoleName
          const getNewRoleData= await roleModel.findOne({$and:[{roleName:newRoleName},{ roleName:{$nin:['TOPADMIN','ADMIN']}}]})
          if(getNewRoleData){
            req.body.roleName = getNewRoleData.roleName
            req.body.roleId = getNewRoleData._id.toString()
          }
      }
      let user =  await userModel.findOne({_id:req.params.id});
      if(!user){
        return res.status(400).json({
          success: false,
          message: "user not found.",
          error: err.message,
        });
      }
      user.userInfo={
        ...user.userInfo,
        ...req.body
      }
      user.modified = new Date();

      await userModel.findOneAndUpdate({_id:req.params.id}, user);
      return res.status(200).json({
        success: true,
        message: "Updated successfully."
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Error while update user.",
        error: err.message,
      });
    }
  },

  updateStatus:  (req, res, next) => {
      try{
      const userId = req.body.userId;
      const datatoUpdate={
        isActive: req.body.isActive && req.body.isActive==="true"? true:false,
        isApproved: req.body.isApproved && req.body.isApproved==="true"? true:false,
        modified: new Date(),
      }
       userModel.findOneAndUpdate({ 'userInfo.userId': userId },datatoUpdate,(err, response) => {
        if (err) {
          next(err);
        }else{
          return res.status(200).json({
            success: true,
            message: "Update status successfully.",
          });
        }
      })
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Error while update status",
        error: err.message,
      });
    }
  },
  getSmsData: async (req, res) => {
    try {
      const { wallet } = await fast2sms.getWalletBalance(authorization);
      // const smsData = await smsModel.find();
       if (wallet) {
        return res.status(200).json({
          success: true,
          message: "SMS data get Successfully",
          // data: smsData,
          wallet,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "SMS data not found.",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  updateRole: async (req, res, next) => {
    try {
      let fdata = await FundingSource.findOneAndUpdate(
        { "withDrawalHistory._id": req.body.transactionId },
        {
          $set: {
            "withDrawalHistory.$.status": true,
            "withDrawalHistory.$.paidDate": new Date(),
          },
        },
        (err, data) => {
          if (err) {
            next();
            return res.status(400).json({
              success: false,
              message: " Something went wrong.",
              error: err.message,
            });
          } else {
            return res.status(200).json({
              success: true,
              message: "Withdrawl updated.",
            });
          }
        }
      );
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },

  getAllEmail: async (req, res) => {
    try {
      const emailData = await emailModel.find({});
      if (emailData) {
        return res.status(200).json({
          success: true,
          message: "Email data get Successfully",
          data: emailData,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "Email data not found.",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  getAllcronJobs: async (req, res) => {
    try {
      const cronjobData = await cronjobModel.find();
      if (cronjobData) {
        return res.status(200).json({
          success: true,
          message: "Cronjob data get Successfully",
          data: cronjobData,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "cronjob data not found.",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  getAllWithdrawals: async (req, res) => {
    try {
      const withdrawalsData = await FundingSource.find(
        {},
        {
          userId: 1,
          roiId: 1,
          withDrawalHistory: 1,
          bankingInformation: 1,
        }
      );
      if (withdrawalsData && withdrawalsData.length) {
        let withdrawal = [];
        withdrawalsData.forEach((it) => {
          if (it.withDrawalHistory && it.withDrawalHistory.length) {
            it.withDrawalHistory.forEach((element) => {
              let data = {
                roiId: it.roiId,
                userId: it.userId,
                actualAmount: element.actualAmount,
                amount: element.amount,
                date: element.data,
                status: element.status,
                transactionId: element._id,
                bankDetails: it.bankingInformation,
                date: element.date,
                paidDate: element.paidDate,
              };
              withdrawal.push(data);
            });
          }
        });

        return res.status(200).json({
          success: true,
          message: "Withdrawal data get Successfully",
          data: withdrawal,
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "withdrawal data not found.",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  backupFund: async (req, res) => {
    // backupFundCreate((result) => {
    //   console.log("result", result);
    // });

    try {
      let curr_date1 = moment.tz(Date.now(), "Asia/Kolkata");
      let dd = curr_date1.date() - 1;
      let mm = curr_date1.month() + 1;
      let yyyy = curr_date1.year();
      let collectionName = `FundingSource_${dd}_${mm}_${yyyy}`;
      FundingSource.aggregate([{ $out: collectionName }], (err, response) => {
        if (err) {
          console.log("err", err);
          return res.status(200).json({
            success: false,
            message: "Backup not created.",
            collections,
          });
        } else {
          // console.log("response", response);
          const conn = mongoose.createConnection(URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
          });
          conn.on("open", function () {
            conn.db
              .listCollections()
              .toArray(function (err, allCollectionNames) {
                if (err) {
                  console.log(err);
                  return res.status(200).json({
                    success: false,
                    message: "Backup not created.",
                    collections,
                  });
                }
                let collections = allCollectionNames
                  .map((data) => data.name)
                  .filter((fdata) => fdata.includes("FundingSource_"));
                conn.close();
                let todayCollection = collections.find(
                  (data) => data == collectionName
                );
                // console.log("todayCollection", todayCollection);
                if (todayCollection) {
                  return res.status(200).json({
                    success: true,
                    message: "Backup Successfully",
                    collections,
                  });
                } else {
                  return res.status(200).json({
                    success: false,
                    message: "Backup not created.",
                    collections,
                  });
                }
              });
          });
        }
      });
      // if (result.data && result.status === true) {
      //   const collections = result.collections;
      //   return res.status(200).json({
      //     success: true,
      //     message: "Backup Successfully.",
      //     collections,
      //   });
      // } else if (result.data && result.status === false) {
      //   const collections = result.collections;
      //   return res.status(200).json({
      //     success: false,
      //     message: "Backup not created .",
      //     collections,
      //   });
      // } else {
      //   return res.status(200).json({
      //     success: false,
      //     message: "Backup not created or Connection error",
      //   });
      // }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  getBackupFund: async (req, res) => {
    try {
      // console.log("response", response);
      const conn = mongoose.createConnection(URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      conn.on("open", function () {
        conn.db.listCollections().toArray(function (err, allCollectionNames) {
          if (err) {
            console.log(err);
            return res.status(200).json({
              success: false,
              message: "Backup collection not get.",
            });
          }
          let collections = allCollectionNames
            .map((data) => {
              return { dbName: data.name };
            })
            .filter((fdata) => fdata.dbName.includes("FundingSource_"));
          conn.close();

          return res.status(200).json({
            success: true,
            message: "Backup collection get Successfully",
            collections,
          });
        });
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  deleteBackupFund: async (req, res) => {
    try {
      // console.log("response", response);
      const conn = mongoose.createConnection(URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      conn.on("open", function () {
        conn.db.listCollections().toArray(function (err, allCollectionNames) {
          if (err) {
            console.log(err);
            return res.status(200).json({
              success: false,
              message: "Backup collection not get.",
            });
          }
          let collections = allCollectionNames
            .map((data) => {
              return { dbName: data.name };
            })
            .filter((fdata) => fdata.dbName.includes("FundingSource_"));
          conn.close();

          return res.status(200).json({
            success: true,
            message: "Backup collection get Successfully",
            collections,
          });
        });
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  genrateRoiIncome: async (req, res) => {
    try {
      let allRoids = await getAllActiveRoi();
      //console.log("allRoids", allRoids);
      // const roiIncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate roi start ", it);
      //     investIncome(it);
      //   }
      // };
      // const level1IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 1 start", it);

      //     level1Income(it);
      //   }
      // };
      // const level2IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 2 start", it);

      //     level2Income(it);
      //   }
      // };
      // const level3IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 3 start", it);

      //     level3Income(it);
      //   }
      // };
      // const level4IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 4 start", it);

      //     level4Income(it);
      //   }
      // };
      // const level5IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 5 start", it);

      //     level5Income(it);
      //   }
      // };
      // const level6IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 6 start", it);

      //     level6Income(it);
      //   }
      // };
      // const level7IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 7 start", it);

      //     level7Income(it);
      //   }
      // };
      // const level8IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 8 start", it);

      //     level8Income(it);
      //   }
      // };
      // const level9IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 9 start", it);

      //     level9Income(it);
      //   }
      // };
      // const level10IncomeGenrate = async () => {
      //   for (it of allRoids) {
      //     console.log(" incomeGenrate level 10 start", it);

      //     level10Income(it);
      //   }
      // };
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
  genrateRoiWithdrawal: async (req, res) => {
    try {
      let allRoids = await getAllActiveRoi();

      try {
        for (it of allRoids) {
          console.log(" Withdrawal cron jobs start", it);
          withDrawalBalance(it);
        }
      } finally {
        return res.status(200).json({
          success: true,
          message: "Withdrawal generated",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: "Something went wrong",
        error: err.response,
      });
    }
  },
};
