const moment = require("moment-timezone");
const fast2sms = require("fast-two-sms");
const mongoose = require("mongoose");
const mongodb = require("mongodb");
const MongoClient = mongodb.MongoClient;
const URL = process.env.MONGO_LOCAL_CONN_URL;
const { userModel } = require("../../models/user");
const { examModel } = require("../../models/exam");
const {roleModel} = require("../../models/role")
const { cronjobModel } = require("../../models/cronjob");
const { FundingSource } = require("../../models/fundingSource");
const { AuthToken } = require("../../models/authtoken");
const { ObjectId } = require("mongodb");
const {s3upload, passwordEncryptAES, newUserIdGen, newInvoiceIdGenrate, sendDailyBackupEmail, currentSession} = require('../../util/helper')
const {
  getAllActiveRoi,
  withDrawalBalance,
  
} = require("../../util/income");
const { resultModel } = require("../../models/result");
const { resultEntryPerModel } = require("../../models/resutlEntryPer");
const {examDateAndSubModel}=require("../../models/examDateAndSub");
const { blogModel } = require("../../models/blog");
const {vehicleModel}=require("../../models/vehicle");
const {vehicleRouteFareModel}=require("../../models/vehicleRouteFare");
const {monthlyFeeListModel}=require("../../models/monthlyFeeList");
const {paymentModel}=require("../../models/payment");
const {invoiceModel}=require("../../models/invoice ");
const fastcsv = require("fast-csv");
const fs = require("fs");
const {payOptionModel}=require("../../models/payOption");
let slugify = require('slugify')
const {default: Axios}=require('axios');



const authorization = process.env.SMS_API;
const UPLOAD_IMAGE_URL = process.env.UPLOAD_IMAGE_URL
const classList=["1 A","1 B","2 A","2 B","3 A","3 B","4 A","4 B","5","6","7","8","9","10","UKG A","UKG B","LKG A","LKG B","NUR A","NUR B","PRE NUR A", "PRE NUR B"]
const examList =['UNIT TEST-I', 'UNIT TEST-II', 'HALF YEARLY EXAM', 'ANNUAL EXAM']
const yearList =['2022-23', '2023-24', '2024-25', '2025-26']
const subjectList =['HINDI', 'ENGLISH', 'MATH','SCIENCE','SST','COMPUTER','COMP PRACT','HINDI NOTES','ENGLISH NOTES','MATH NOTES','SCIENCE NOTES','SST NOTES','HINDI SUB ENRICH','ENGLISH SUB ENRICH','MATH SUB ENRICH','SCIENCE SUB ENRICH','SST SUB ENRICH','HINDI RHYMES','ENGLISH RHYMES','DRAWING','GK MV','ATTENDANCE']
const monthList =  ["april", "may", "june", "july", "august", "september", "october", "november", "december","january", "february", "march"] 
const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const performanceList= [
  {grade:'A1', performance:'Outstanding'},
  {grade:'A2', performance:'Excellent'},
  {grade:'B1', performance:'Very Good'},
  {grade:'B2', performance:'Good'},
  {grade:'C1', performance:'Above Average'},
  {grade:'C2', performance:'Average'},
  {grade:'D',  performance:'Pass'},
  {grade:'E',  performance:'Fail'},
]
const getGrade=(score)=>{
  if(score > 100 || score < 0) return "INVALID SCORE";
  if(score >=91) {
    return "A1"
  }else if(score >=81) {
    return "A2"
  }else if(score >=71) {
    return "B1"
  }else if(score >=61) {
    return "B2"
  }else if(score >=51) {
    return "C1"
  }else if(score >=41) {
    return "C2"
  }else if(score >=33) {
    return "D"
  }else{
    return "E"
  }
 }

const getPerformance =(grade)=>{
  
  const performanceObj = performanceList.find( data => data.grade === grade)
  if(performanceObj){
    return performanceObj.performance
  }else{
    return 'Invalid'
  }
}
const percentageMarks= (getTotal, fullMarks)=>{
  return ((Number(getTotal)*100)/Number(fullMarks)).toFixed(2)
}

checkAdmissionDate=(user, columnMonth)=>{
  let pay=true
  if(user.created){
    let columnMonthIndex=  monthNames.indexOf(columnMonth.toLowerCase())
    if(user.userInfo.admissionDate){
        const admissionDate = new Date(user.userInfo.admissionDate)
        //console.log("admissionDateadmissionDate",admissionDate)
        const admissionDay = admissionDate.getDate()
        //console.log("admissionDay",admissionDay) 
        const admissionYear = admissionDate.getFullYear()
        const admissionMonthIndex = admissionDate.getMonth()
        let admissionSession=''
        if(admissionMonthIndex>=3){
          admissionSession = `${(admissionYear).toString()}-${(admissionYear+1).toString().substring(2)}`
        }else if(admissionMonthIndex<3 ){
          admissionSession = `${(admissionYear-1).toString()}-${(admissionYear).toString().substring(2)}`
        }
        if(columnMonthIndex>=3 && currentSession()===admissionSession && (admissionMonthIndex>columnMonthIndex || (admissionMonthIndex===columnMonthIndex && admissionDay>=21 || (admissionMonthIndex<3 && admissionMonthIndex<columnMonthIndex )) )){
          pay= false
        
        }else if(columnMonthIndex<3 && admissionMonthIndex<3 && currentSession()===admissionSession && (admissionMonthIndex>columnMonthIndex || (admissionMonthIndex===columnMonthIndex && admissionDay>=21))){
          pay= false
        }
    }
  }
  return pay

}
                    //(Sdata, userPayDetail, monthlyFeeList, busRouteFareList)
const getMonthPayData=(sData, userPayDetail, monthlyFeeList, busRouteFareList )=>{
  let busFee= 0
  let monthlyFee=0
  if(sData.userInfo.busService && busRouteFareList.length>0){
    busFee= busRouteFareList.find(busData => busData._id.toString() === sData.userInfo.busRouteId)?.fare
  }
  if(monthlyFeeList.length>0 ){
    monthlyFee= monthlyFeeList.find(data => data.className === sData.userInfo.class)?.monthlyFee
  }
  let monthPayData={}
  for (const month of monthList) {
    let monthData={}
    const monthEnable =  checkAdmissionDate(sData, month)
      if(monthEnable){
        monthData['monthlyFee']= monthlyFee
        monthData['busFee']= busFee
        monthData['payEnable']=true
        monthData['paidDone']=userPayDetail && userPayDetail[month]? true: false
        monthData['amt'] = userPayDetail && userPayDetail[month]? (parseInt(userPayDetail[month].monthlyFee) + parseInt(userPayDetail[month].busFee)):"000"
      }else{
        monthData['payEnable']=false
      }
      monthPayData[month]= monthData
  }
  return monthPayData
}

const activeParam = {$and:[{deleted:false},{isApproved:true}, {isActive:true}]}



module.exports = {
  getAllUsers: async (req, res) => {
    try {
      const searchStr= req.body.searchStr
      let searchParam={}
      let classParam={}
      let roleParam={}
       if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
         searchParam={
          $or:[
            {'userInfo.roleName': new RegExp(searchStr, 'i')},
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber1': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber2': new RegExp(searchStr, 'i')},
            {'userInfo.aadharNumber':new RegExp(searchStr, 'i')},
            {'userInfo.userId':new RegExp(searchStr, 'i')}
          ]
        }
      }
      if(req.body.selectedClass){
          classParam={'userInfo.class':req.body.selectedClass}
      }

      if(req.body.selectedRole){
        roleParam={'userInfo.roleName':req.body.selectedRole}
      }

      if(req.body.studentId){
        searchParam={'_id':req.body.studentId}
      }
      let query = {
        $and: [ { deleted: false },searchParam,classParam,roleParam]
      }

      //console.log("gggggggggggggghhhhhhhhhhhhhhhh", JSON.stringify(query))
      const users = await userModel.find(query);
      if(users && users.length>0){
        return res.status(200).json({
          success: true,
          message: 'Successfully get all users.',
          users,
        });
      }else{
        return res.status(200).json({
          success: false,
          message: 'Users not found.',
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  getAllStudents: async (req, res) => {
    try {
      const searchStr= req.body.searchStr
      let studentAprroveParam = {$and:[{deleted:false},{isApproved:true}]}
      let searchParam={}
      let classParam={}
      let filterOptionParam={}
      let dataFilterParam={}
      let studentById={}
      let sortingOption={'created':'desc'}
       if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
         searchParam={
          $or:[
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber1': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber2': new RegExp(searchStr, 'i')},
            {'userInfo.aadharNumber':new RegExp(searchStr, 'i')},
            {'userInfo.userId':new RegExp(searchStr, 'i')}
          ]
        }
      }
      if(req.body.role==='TEACHER'){
        dataFilterParam={
          'userInfo.phoneNumber': 0,
          'userInfo.phoneNumber1': 0,
          'userInfo.phoneNumber2': 0,  
          'userInfo.aadharNumber': 0,
        }
      }

      if(req.body.selectedClass){
        classParam={'userInfo.class':req.body.selectedClass}
      }
      if(req.body.filterOption && req.body.docFilter===true){
        filterOptionParam={[`document.${req.body.filterOption}`]:{$exists:false}}
      }else if(req.body.filterOption && req.body.docFilter===false){
        if(req.body.filterOption==='No Mobile Number'){
          filterOptionParam={'userInfo.phoneNumber1':''}
        }
        if(req.body.filterOption==='No Aadhar'){
          filterOptionParam={'userInfo.aadharNumber':''}
        }
        if(req.body.filterOption==='Deactive'){
          studentAprroveParam={$and:[{deleted:false},{isApproved:true},{isActive:false}]}
        }

      }
      if(req.body.studentId){
        studentById={'_id': req.body.studentId}
      }
      const condParam={
        $and: [
          studentAprroveParam,
          {
            'userInfo.roleName':'STUDENT'
          },
          searchParam,
          classParam,
          filterOptionParam,
          studentById
        ],
      }
      if(req.body.sortByClass){
        sortingOption={'userInfo.class':req.body.sortByClass}
      }
      //console.log("condParammmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm", JSON.stringify(condParam))
      const users = await userModel.find(condParam,dataFilterParam).sort(sortingOption);
    
      if(users && users.length>0){
        return res.status(200).json({
          success: true,
          message: 'Successfully get all students.',
          users,
        });
      }else{
        return res.status(200).json({
          success: false,
          message: 'Students not found.',
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  getAllTeacherAndStaff: async (req, res) => {
    try {
      const searchStr= req.body.searchStr
      let searchParam={}
      let classParam={}
      let roleParam=   {$or:[{'userInfo.roleName':'TEACHER'},{'userInfo.roleName':'ACCOUNTANT'}]}
       if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
         searchParam={
          $or:[
            {'userInfo.roleName': new RegExp(searchStr, 'i')},
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber1': new RegExp(searchStr, 'i')},
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
        $and: [ { deleted: false },searchParam,classParam,roleParam]
      });
      if(users && users.length>0){
        return res.status(200).json({
          success: true,
          message: 'Successfully get all teacher and staff',
          users,
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "Teacher and staff not found.",
        });
      }
   
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  deleteUser: async (req, res) => {
    try {
    const updatedUser=  await userModel.findOneAndUpdate({_id:req.params.id},{deleted: true, modified:new Date()});
     if(updatedUser){
        return res.status(200).json({
          success: true,
          message: 'Deleted user successfully',
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "Not deleted user.",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
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
        return res.status(200).json({
          success: false,
          message: "user not found.",
        });
      }
      if(req.body.student_document){
        user['document']={
          ...user['document'],
          ...req.body.student_document
        }
      }else if(req.body.passwordChange){
        user.userInfo.password= passwordEncryptAES(req.body.password)
      }else{
        user.userInfo={
          ...user.userInfo,
          ...req.body
        }
      }

      user.modified = new Date();

     const updatedUser= await userModel.findOneAndUpdate({_id:req.params.id}, user,{new:true});
      if(updatedUser && req.body.passwordChange){
        await AuthToken.deleteMany({ userId: user.userInfo.userId })
      }
      if(updatedUser){
        return res.status(200).json({
          success: true,
          message: "Updated successfully.",
          data:updatedUser
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "Not updated user.",
        });
      }

    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  uploadDocumentS3:(req, res, next)=>{
    console.log("userIdddddddddddddddddddddddd",req.body.userId)
    console.log("imagefileeeeeeeeeeeeee", req.files.document)
    const userId =req.body.userId
    //const fileName= `${req.body.userId}_${req.body.fileName.split('_')[1]}`
    const fileName=req.body.fileName
    console.log("fileNameeeeeeeeeeeee", fileName)
    const file= req.files.document
    s3upload(userId,fileName, file)

  },

  updateStatus:  (req, res, next) => {
      try{
      const userId = req.body.userId;
      let datatoUpdate={}
      if(req.body.recover){
        datatoUpdate={
          isActive:true,
          isApproved: true,
          modified: new Date(),
          deleted:false
        }
      }else{

        if(req.body.task==='isApproved'){
          datatoUpdate={
            isApproved: req.body.isApproved,
            modified: new Date(),
          }
        }
    
        if(req.body.task==='isActive'){
          datatoUpdate={
            isActive: req.body.isActive ,
            modified: new Date(),
          }
        }
      }

       userModel.findOneAndUpdate({ 'userInfo.userId': userId },datatoUpdate, async (err, response) => {
        if (err) {
          next(err);
        }else{
          if(datatoUpdate.isActive ===false || datatoUpdate.isApproved===false){
            await AuthToken.deleteMany({ userId: userId })
          }
          return res.status(200).json({
            success: true,
            message: "Update status successfully.",
          });
        }
      })
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  updatePaymentRecieverUser:  (req, res, next) => {
    try{

        userModel.findOne({ 'userInfo.userId': req.body.userId }, async (err, response) => {
          if (err) {
            next(err);
          }else{
            const role= response.userInfo.roleName
            if(role==='ADMIN' || role==='ACCOUNTANT'){
              response['isPaymentReciever'] = req.body.status
              response.modified = new Date()
              response.save()
              return res.status(200).json({
                success: true,
                message: "Update status successfully.",
              });
            }else{
              return res.status(200).json({
                success: false,
                message: "Can't update as payment reciever. Contact to Admin"
              })
            }
          }
        })
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  },
  getPaymentRecieverUser: async (req, res) => {
    try {
      let allPaymentRecieverUser = await userModel.find({$and:[{'userInfo.roleName':{$in:['ADMIN','ACCOUNTANT']}},{isPaymentReciever:true}]})
      if(allPaymentRecieverUser && allPaymentRecieverUser.length>0){
        return res.status(200).json({
          success: true,
          message: "Payment Reciever List successfully.",
          data:allPaymentRecieverUser
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "Payment Reciever List not found.",
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  getSmsData: async (req, res) => {
    try {
      const { wallet } = await fast2sms.getWalletBalance(authorization);
       if (wallet) {
        return res.status(200).json({
          success: true,
          message: "SMS data get Successfully",
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
        message: err.message,
      });
    }
  },

  submitResult: async (req, res) => {
    try {
      //console.log("req", req.body)
      const resultData= req.body

      if(resultData.resultPermissionData.role==='TEACHER' && resultData.subject){
          let subjectName=  resultData.subject.toLowerCase().trim()
          subjectName = subjectName.includes(' ')? subjectName.split(' ').join('_'):subjectName
        //  console.log("subject", subjectName)
        const examType = resultData.resultPermissionData.examType
        for (const it of resultData.resultMarks) {
          // console.log("userId", it.userId)
          //   let result={
          //     subjects:{}
          //   }
          //   // if(resultData.resultPermissionData.examType.includes('unit')){
          //   //   result.subjects['HINDI']=0
          //   //   result.subjects['ENGLISH']=0
          //   //   result.subjects['MATH']=0
          //   //   result.subjects['SCIENCE']=0
          //   //   result.subjects['SST']=0
          //   //   result.subjects['COMPUTER']=0
          //   // }
          //   result.subjects[subjectName]=it.marks
       
          //   console.log("resultttttttttttttttt",result)
          //   const subjectParam= `subjects.${subjectName}`
            
       
          //  const newAndUpdateRsultEntry= await resultModel.findOneAndUpdate({$and:[
          //   {userId:it.userId},
          //   {resultYear:resultData.resultPermissionData.resultYear},
          //   {examType:resultData.resultPermissionData.examType},
          //   {class:resultData.class},
          //   {subjectParam:subjectName}
          //   ]},
          //    result,   
          //    {upsert: true, new:true},
          //   );


          const resultParam ={$and:[
            {userId:it.userId},
            {resultYear:resultData.resultPermissionData.resultYear},
            {examType:resultData.resultPermissionData.examType},
            {class:resultData.class},
            ]}
            let resultEntryFound= await resultModel.findOne(resultParam);
            if(resultEntryFound){
              if(subjectName==='attendance'){
                if(examType.includes('HALF')){
                  resultEntryFound.attendance1 = it.marks
                }else{
                  resultEntryFound.attendance2 = it.marks
                }
              }else{
                if(resultEntryFound.subjects){
                  resultEntryFound.subjects[subjectName]=it.marks
                }else{
                  let resultEntryData=resultEntryFound
                  resultEntryData['subjects']={
                    [subjectName]:it.marks
                  }
                }
              }
              await resultModel.findOneAndUpdate(resultParam,resultEntryFound )

            }else{
                let result={
                    subjects:{}
                  }
                  if(subjectName==='attendance'){
                    if(examType.includes('HALF')){
                      result.attendance1 = it.marks
                    }else{
                      result.attendance2 = it.marks
                    }
                  }else{
                    result.subjects[subjectName] = it.marks
                  }
                  const newResultEntryData=resultModel({
                    userId:it.userId,
                    resultYear:resultData.resultPermissionData.resultYear,
                    examType:resultData.resultPermissionData.examType,
                    class:resultData.class,
                    ...result
                  })
                  //console.log('newRsultEntryDataaaaaaaaaaaaaaaaaaaa',newResultEntryData)
                 const  newResultEntryCreated = await newResultEntryData.save()
            }
        }

        return res.status(200).json({
            success: true,
            message: "Update result successfully.",
        });

      }
      // else if(resultData.resultPermissionData.role==='ADMIN'){
      //     for (let it of resultData.totalResultMarks) {
          
      //      const updateRsultEntry= await resultModel.findOneAndUpdate({$and:[
      //       {userId:it.userId},
      //       {resultYear:resultData.resultPermissionData.resultYear},
      //       {examType:resultData.resultPermissionData.examType},
      //       {class:resultData.class}
      //       ]},
      //       it,   
      //        {new:true},
      //       );

      //       console.log("updateRsultEntry",updateRsultEntry)
      //   }

      // }

    
   

    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  getResult: async (req, res) => {
    try {
      //console.log("req", req.body)
    const resultQuery= req.body
     const userData =  await userModel.find({$and:[{'userInfo.class':resultQuery.selectedClass},{'userInfo.roleName':'STUDENT'},activeParam]});
      if(resultQuery.resultPermissionData.action==='ENTRY'){
          let subjectName=  resultQuery.selectedSubject && resultQuery.selectedSubject.toLowerCase().trim()
          subjectName = subjectName.includes(' ')?subjectName.split(' ').join('_'):subjectName
          let subjectPermissionParam={
            userId:1,
          }
          if(subjectName==='attendance' && resultQuery.resultPermissionData.examType.includes('HALF')) {
            subjectPermissionParam.attendance1=1
            
          } else if(subjectName==='attendance' && resultQuery.resultPermissionData.examType.includes('ANNUAL')){
            subjectPermissionParam.attendance2=1

          }else{
            subjectPermissionParam={
              userId:1,
              subjects:{}
            }
            subjectPermissionParam.subjects[subjectName]=1
          }  
 
          let resultParam={
            $and:[
            {resultYear:resultQuery.resultPermissionData.resultYear},
            {examType:resultQuery.resultPermissionData.examType},
            {class:resultQuery.selectedClass},
            ]
          }
        const resultData = await resultModel.find(resultParam,subjectPermissionParam);
          return res.status(200).json({
            success: true,
            message: "Result get successfully.",
            result:resultData
          });
    
      }else if(resultQuery.resultPermissionData.role==='ADMIN'){
       
        const fullMarks =resultQuery.fullMarks
        const classBetween1to10 = resultQuery.classBetween1to10
        const class9to10 = resultQuery.class9to10
        const examType= resultQuery.resultPermissionData.examType
        const resultYear= resultQuery.resultPermissionData.resultYear
        // console.log("examTypeexamType", examType)
        // console.log("resultYearresultYear", resultYear)
        const examData = await examModel.findOne({$and:[{examType:examType},{examYear:resultYear}]});
       
        //console.log("examDataexamData", examData.fullAttendance)
        const fullAttendance = examData && examData.fullAttendance?examData.fullAttendance:0
        const mainExams =  (examType==='ANNUAL EXAM' || examType==='HALF YEARLY EXAM')?true:false
        let resultParam={}
        let secondResultParam={}
        
      
          if(userData && userData.length>0){
            if(mainExams && classBetween1to10){
              if(examType==='ANNUAL EXAM'){
                resultParam = { 
                  resultYear:resultYear,
                  examType:'UNIT TEST-II',
                  class:resultQuery.selectedClass
                }
                secondResultParam = {
                  resultYear:resultYear,
                  examType:examType,
                  class:resultQuery.selectedClass
                }
              }else{
                resultParam = { 
                  resultYear:resultYear,
                  examType:'UNIT TEST-I',
                  class:resultQuery.selectedClass
                }
                secondResultParam = {
                  resultYear:resultYear,
                  examType:examType,
                  class:resultQuery.selectedClass
                }
              }
      
                let newResultData=[]
                    for (const studentData of userData) {
                    let studentResultData = {
                      ...studentData.userInfo
                    }
                    let total = 0 
                    const secondResultData = await resultModel.findOne({$and:[
                      {
                        ...secondResultParam,
                        userId:studentData.userInfo.userId}
                    ]})
                    
                        if(secondResultData){
                          let subjectsValues=0
                          if(class9to10){

                            const copyOfSecondResultData = JSON.parse(JSON.stringify(secondResultData));
                       
                            Object.defineProperty(copyOfSecondResultData.subjects , 'computer', {
                              enumerable: false,  
                            });
                            Object.defineProperty(copyOfSecondResultData.subjects , 'comp_pract', {
                              enumerable: false,  
                            });
                            subjectsValues = (copyOfSecondResultData && copyOfSecondResultData.subjects)? Object.values(copyOfSecondResultData.subjects):0;
                          }else{
                            subjectsValues = (secondResultData && secondResultData.subjects)? Object.values(secondResultData.subjects):0;
                          }
                          
                          total = subjectsValues ? subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0):0
                          studentResultData={
                            ...studentResultData,
                            studentResultSecond: secondResultData? secondResultData:{},
                            total: total
                          }

                        }else{
                          studentResultData = {
                            ...studentResultData,
                            studentResultSecond: {},
                            total: total
                          }
                        }

                      const unitResultData = await resultModel.findOne({$and:[
                          {...resultParam,userId: studentData.userInfo.userId}
                        ]})

                        if(unitResultData){
                          let subjectsValues=0
                          if(class9to10){
                            // const copyOfUnitResultData= unitResultData
                            // console.log("copyOfUnitResultData",copyOfUnitResultData)
                            // Object.defineProperty(copyOfUnitResultData.subjects, 'computer', {
                            //   enumerable: false,  
                            // });
                            let unitTotal=0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.hindi ? Number(unitResultData.subjects.hindi)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.english ? Number(unitResultData.subjects.english)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.math ? Number(unitResultData.subjects.math)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.science ? Number(unitResultData.subjects.science)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.sst ? Number(unitResultData.subjects.sst)/2:0

                            // subjectsValues = (copyOfUnitResultData && copyOfUnitResultData.subjects)? Object.values(copyOfUnitResultData.subjects):0;
                            // total += subjectsValues ? (subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0))/2:0
                            total +=unitTotal
                          }else{
                            let unitTotal=0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.hindi ? Number(unitResultData.subjects.hindi):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.english ? Number(unitResultData.subjects.english):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.math ? Number(unitResultData.subjects.math):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.science ? Number(unitResultData.subjects.science):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.sst ? Number(unitResultData.subjects.sst):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.computer ? Number(unitResultData.subjects.computer):0
                            // subjectsValues = (unitResultData && unitResultData.subjects)? Object.values(unitResultData.subjects):0;
                            // total += subjectsValues ? subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0):0
                            total += unitTotal
                          }
                         
                       
                          studentResultData = {
                            ...studentResultData,
                            studentResult: unitResultData? unitResultData:{},
                            total: total
                          }
                        }else{
                          studentResultData = {
                            ...studentResultData,
                            studentResult: {},
                            total: total
                          }
                        }
                        newResultData.push(studentResultData)
                      }
                  
                  const sortResultData =  newResultData.slice().sort((a,b) => b.total - a.total);
                  const actualResult = newResultData.map(originalData=> {
                      const sortDataIndex = sortResultData.findIndex((sortdata)=> (originalData && originalData.userId) === (sortdata && sortdata.userId))
                          const percentage = percentageMarks(originalData.total, fullMarks)
                          const grade = getGrade(percentage)
                          const performance= getPerformance(grade)
                          const ddd= {
                            ...originalData,
                            rank:sortDataIndex +1,
                            percentage :percentage,
                            grade:grade ,
                            performance:performance,
                            fullMarks:fullMarks,
                            fullAttendance:fullAttendance
                          }
                          return ddd
                      }
                    )
                return res.status(200).json({
                  success: true,
                  message: "Result get successfully.",
                  result:actualResult
                });
            }else{
            
              const resultParam={
                $and:[
                {resultYear:resultYear},
                {examType:resultQuery.resultPermissionData.examType},
                {class:resultQuery.selectedClass}
                ]
              }
            
              const resultData = await resultModel.find(resultParam);
              if(userData && userData.length>0){
                const newResultData = userData.map(data=>{
                  const found = resultData.find(element => element.userId === data.userInfo.userId);
                    if(found){
                      const subjectsValues = Object.values(found.subjects);
                      const total = subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0)
                  
                      let newResultData = {
                        ...data.userInfo,
                        studentResult:found,
                        total:total
                        }
                    
                        return newResultData
                    }else{
                      const newResultData = {
                        ...data.userInfo,
                        studentResult:{},
                        total:0
                        }
                        return newResultData
                    }
                })
              
              const sortResultData =  newResultData.slice().sort((a,b) => b.total - a.total);
              const actualResult = newResultData.map(originalData=> {
                  const sortDataIndex = sortResultData.findIndex((sortdata)=> originalData.userId === sortdata.userId)
                  let ddd = {}
                  if(mainExams){
                    const percentage = percentageMarks(originalData.total, fullMarks)
                    const grade = getGrade(percentage)
                    const performance= getPerformance(grade)
                     ddd= {
                      ...originalData,
                      rank:sortDataIndex +1,
                      percentage :percentage,
                      grade:grade ,
                      performance:performance,
                      fullMarks:fullMarks,
                      fullAttendance:fullAttendance
                    }
                  }else{
                     ddd = {
                      ...originalData,
                      rank:sortDataIndex +1
                    }
                  }
                      return ddd
                  }
                )
                return res.status(200).json({
                  success: true,
                  message: "Result get successfully.",
                  result:actualResult
                });
              }
            }
          }else{
            return res.status(200).json({
              success: false,
              message: "Result not found.",
            });
          }
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  oldExamResult: async (req, res) => {
    try {
      //console.log("req", req.body)
    const resultQuery= req.body
     //const userData =  await userModel.find({$and:[{'userInfo.class':resultQuery.selectedClass},{'userInfo.roleName':'STUDENT'},activeParam]});

        const fullAttendance =resultQuery.fullAttendance
        const fullMarks =resultQuery.fullMarks
        const classBetween1to10 = resultQuery.classBetween1to10
        const class9to10 = resultQuery.class9to10
        const examType= resultQuery.resultPermissionData.examType
        const mainExams =  (examType==='ANNUAL EXAM' || examType==='HALF YEARLY EXAM')?true:false
        let resultParam={}
        let secondResultParam={}
            if(mainExams && classBetween1to10){
              if(examType==='ANNUAL EXAM'){
                resultParam = { 
                  resultYear:resultQuery.resultPermissionData.resultYear,
                  examType:'UNIT TEST-II',
                  class:resultQuery.selectedClass
                }
                secondResultParam = {
                  resultYear:resultQuery.resultPermissionData.resultYear,
                  examType:examType,
                  class:resultQuery.selectedClass
                }
              }else{
                resultParam = { 
                  resultYear:resultQuery.resultPermissionData.resultYear,
                  examType:'UNIT TEST-I',
                  class:resultQuery.selectedClass
                }
                secondResultParam = {
                  resultYear:resultQuery.resultPermissionData.resultYear,
                  examType:examType,
                  class:resultQuery.selectedClass
                }
              }
      
                let newResultData=[]
                    let total = 0 
                    const secondResultDataAll = await resultModel.find({$and:[
                      {
                        ...secondResultParam,
                      }
                    ]})
                    if(secondResultDataAll && secondResultDataAll.length>0){
                      for(const secondResultData of secondResultDataAll){
                        const studentData= await userModel.findOne({'userInfo.userId':secondResultData.userId})
                        let studentResultData={}
                        if(studentData){
                          studentResultData = {
                            ...studentData.userInfo,
                          }
                        }
                    
                        if(secondResultData){
                          let subjectsValues=0
                          if(class9to10){

                            const copyOfSecondResultData = JSON.parse(JSON.stringify(secondResultData));
                       
                            Object.defineProperty(copyOfSecondResultData.subjects , 'computer', {
                              enumerable: false,  
                            });
                            Object.defineProperty(copyOfSecondResultData.subjects , 'comp_pract', {
                              enumerable: false,  
                            });
                            subjectsValues = (copyOfSecondResultData && copyOfSecondResultData.subjects)? Object.values(copyOfSecondResultData.subjects):0;
                          }else{
                            subjectsValues = (secondResultData && secondResultData.subjects)? Object.values(secondResultData.subjects):0;
                          }
                          
                          total = subjectsValues ? subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0):0
                          studentResultData={
                            ...studentResultData,
                            studentResultSecond: secondResultData? secondResultData:{},
                            total: total
                          }

                        }else{
                          studentResultData = {
                            ...studentResultData,
                            studentResultSecond: {},
                            total: total
                          }
                        }

                      const unitResultData = await resultModel.findOne({$and:[
                          {...resultParam,userId: studentData.userInfo.userId}
                        ]})

                        if(unitResultData){
                          let subjectsValues=0
                          if(class9to10){
                            // const copyOfUnitResultData= unitResultData
                            // console.log("copyOfUnitResultData",copyOfUnitResultData)
                            // Object.defineProperty(copyOfUnitResultData.subjects, 'computer', {
                            //   enumerable: false,  
                            // });
                            let unitTotal=0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.hindi ? Number(unitResultData.subjects.hindi)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.english ? Number(unitResultData.subjects.english)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.math ? Number(unitResultData.subjects.math)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.science ? Number(unitResultData.subjects.science)/2:0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.sst ? Number(unitResultData.subjects.sst)/2:0

                            // subjectsValues = (copyOfUnitResultData && copyOfUnitResultData.subjects)? Object.values(copyOfUnitResultData.subjects):0;
                            // total += subjectsValues ? (subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0))/2:0
                            total +=unitTotal
                          }else{
                            let unitTotal=0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.hindi ? Number(unitResultData.subjects.hindi):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.english ? Number(unitResultData.subjects.english):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.math ? Number(unitResultData.subjects.math):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.science ? Number(unitResultData.subjects.science):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.sst ? Number(unitResultData.subjects.sst):0
                            unitTotal +=  unitResultData.subjects && unitResultData.subjects.computer ? Number(unitResultData.subjects.computer):0
                            // subjectsValues = (unitResultData && unitResultData.subjects)? Object.values(unitResultData.subjects):0;
                            // total += subjectsValues ? subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0):0
                            total += unitTotal
                          }
                         
                       
                          studentResultData = {
                            ...studentResultData,
                            studentResult: unitResultData? unitResultData:{},
                            total: total
                          }
                        }else{
                          studentResultData = {
                            ...studentResultData,
                            studentResult: {},
                            total: total
                          }
                        }
                        newResultData.push(studentResultData)
                      }
                    }else{
                      return res.status(200).json({
                            success: false,
                            message: "Result not found.",
                          });
                    }
                  
                  const sortResultData =  newResultData.slice().sort((a,b) => b.total - a.total);
                  const actualResult = newResultData.map(originalData=> {
                      const sortDataIndex = sortResultData.findIndex((sortdata)=> (originalData && originalData.userId) === (sortdata && sortdata.userId))
                          const percentage = percentageMarks(originalData.total, fullMarks)
                          const grade = getGrade(percentage)
                          const performance= getPerformance(grade)
                          const ddd= {
                            ...originalData,
                            rank:sortDataIndex +1,
                            percentage :percentage,
                            grade:grade ,
                            performance:performance,
                            fullMarks:fullMarks,
                            fullAttendance:fullAttendance
                          }
                          return ddd
                      }
                    )
                return res.status(200).json({
                  success: true,
                  message: "Result get successfully.",
                  result:actualResult
                });
              
            }else{
              const resultParam={
                $and:[
                {resultYear:resultQuery.resultPermissionData.resultYear},
                {examType:resultQuery.resultPermissionData.examType},
                {class:resultQuery.selectedClass}
                ]
              }
              let newResultData=[]
              const allResultData = await resultModel.find(resultParam);
              if(allResultData && allResultData.length>0){
                for(const rData of allResultData){

                  const userfound = await userModel.findOne({'userInfo.userId':rData.userId});
                    if(userfound){
                      const subjectsValues = Object.values(rData.subjects);
                      const total = subjectsValues.reduce((sum, curr)=> sum+Number(curr), 0)
                      let resultData = {
                        ...userfound.userInfo,
                        studentResult:rData,
                        total:total
                        }
                        newResultData.push(resultData)
                    }
                }
              
              const sortResultData =  newResultData.slice().sort((a,b) => b.total - a.total);
              const actualResult = newResultData.map(originalData=> {
                  const sortDataIndex = sortResultData.findIndex((sortdata)=> originalData.userId === sortdata.userId)
                  let ddd = {}
                  if(mainExams){
                    const percentage = percentageMarks(originalData.total, fullMarks)
                    const grade = getGrade(percentage)
                    const performance= getPerformance(grade)
                     ddd= {
                      ...originalData,
                      rank:sortDataIndex +1,
                      percentage :percentage,
                      grade:grade ,
                      performance:performance,
                      fullMarks:fullMarks,
                      fullAttendance:fullAttendance
                    }
                  }else{
                     ddd = {
                      ...originalData,
                      rank:sortDataIndex +1
                    }
                  }
                      return ddd
                  }
                )
                return res.status(200).json({
                  success: true,
                  message: "Result get successfully.",
                  result:actualResult
                });
              }else{
                return res.status(200).json({
                  success: false,
                  message: "Result not found.",
                });
              }
            }
     
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  getDeletedUser: async (req, res) => {
    try {
      const searchStr= req.body.searchStr
      let searchParam={}
       if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
         searchParam={
          $or:[
            {'userInfo.roleName': new RegExp(searchStr, 'i')},
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber1': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber2': new RegExp(searchStr, 'i')},
            {'userInfo.aadharNumber':new RegExp(searchStr, 'i')},
            {'userInfo.userId':new RegExp(searchStr, 'i')}
          ]
        }
      }

      const users = await userModel.find({
        $and: [ { deleted: true },searchParam]
      });
      if(users && users.length){
        return res.status(200).json({
          success: true,
          message: 'Deleted user get successfully',
          users,
        });
      }else{
        return res.status(200).json({
          success: true,
          message: 'Deleted user not found',
        });
      }

    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  permanentDeleteUser: async (req, res) => {
    try {
     await userModel.deleteOne({_id:req.params.id});
      return res.status(200).json({
        success: true,
        message: "Deleted successfully."
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  reportData: async (req, res) => {
    try {
      let repodata={}
    let queryParam={}
    if(req.body.deleteOption){
      queryParam={
        ...queryParam,
        deleted:req.body.deleteOption==='true'?true:false,
      }
    }
    if(req.body.activeOption){
      queryParam={
        ...queryParam,
        isActive:req.body.activeOption==='true'?true:false,
      }
    }
    if(req.body.gender){
      queryParam={
        ...queryParam,
        'userInfo.gender':req.body.gender,
      }
    }
    if(req.body.selectedClass){
      queryParam={
        ...queryParam,
        'userInfo.class':req.body.selectedClass,
      }
    }
    if(req.body.selectedRole){
      queryParam={
        ...queryParam,
        'userInfo.roleName':req.body.selectedRole,
      }
    }
    if(req.body.selectedCategory){
      queryParam={
        ...queryParam,
        'userInfo.category':req.body.selectedCategory,
      }
    }

   const reportCount= await userModel.find({$and:[activeParam,queryParam]}).count();

    return res.status(200).json({
      success: true,
      message: "Report Data get successfully.",
      reportData:repodata,
      reportCount:reportCount?reportCount:0,
    });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  createExam: async (req, res) => {
    try {
     const oldExam = await examModel.findOne({$and:[{examType:req.body.examType},{examYear:req.body.examYear}]});
     if(!oldExam){
      const examData=new examModel({
        examType: req.body.examType,
        examYear: req.body.examYear,
        fullAttendance: req.body.fullAttendance,
        created: new Date(),
        modified: new Date()
      })
      let newExamData = await examData.save();
      if(newExamData){
        return res.status(200).json({
          success: true,
          message: "exam created successfully."
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "exam not created."
        });
      }
    }else{
      return res.status(200).json({
        success: false,
        message: "exam already created."
      });
    }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  updateExam: async (req, res) => {
    try {
      let newUpdate=null
      if(req.body.key==='primary'){
        newUpdate= await examModel.findOneAndUpdate({_id:req.body.examId},{primary:req.body.value, modified: new Date()});
      }
      if(req.body.key==='attendence'){
        newUpdate= await examModel.findOneAndUpdate({_id:req.body.examId},{fullAttendance:req.body.fullAttendance, modified: new Date()});
      }
      if(req.body.key==='adminEntryAllow'){
        newUpdate= await examModel.findOneAndUpdate({_id:req.body.examId},{adminAllowed:req.body.value, modified: new Date()});
      }
      if(newUpdate){
        return res.status(200).json({
          success: true,
          message: "exam updated successfully."
        });
      }else{
        return res.status(200).json({
          success: false,
          message: "exam not updated try again."
        });
      }
     
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  deleteExam: async (req, res) => {
    try {
    const updatedExam=  await examModel.findOneAndUpdate({_id:req.params.id},{deleted:true});
      if(updatedExam){
        return res.status(200).json({
          success: true,
          message: "Deleted exam successfully."
        });
      }else{
        return res.status(200).json({
          success: true,
          message: "Exam not deleted."
        });
      }

    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  getExam:async(req, res)=>{
    try{
      const getExamsData= await examModel.find({})
      const getResultEntryPerData = await resultEntryPerModel.find({});
      const getTeacherData= await userModel.find({$and:[activeParam, {'userInfo.roleName':'TEACHER'}]})
      // let filterGetResultEntryPerData=[]
      // for (const data of getResultEntryPerData) {
      //   const userFound= getTeacherData.find(it=> it.userInfo.userId===data.userId)
      //   if(userFound){
      //     const permissionData= JSON.parse(JSON.stringify(data))
      //       const newData= {
      //         ...userFound.userInfo,
      //         ...permissionData,
      //       }
      //       filterGetResultEntryPerData.push(newData)
      //   }
      // }
      const sendData={
        examsData:getExamsData? getExamsData:[],
        teacherData:getTeacherData? getTeacherData:[],
        resultEntryPerData:getResultEntryPerData? getResultEntryPerData:[]
      }

        return res.status(200).json({
          success: true,
          message: "Exam data get successfully.",
          data: sendData
        })
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  getExamDateAndSub:async(req, res)=>{
    try{
      const getExamsData= await examDateAndSubModel.find({})
      if(getExamsData){
        return res.status(200).json({
          success: true,
          message: "Exam data get successfully.",
          data: getExamsData
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Exam data not found.",
        })
      }

    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  updateExamDateAndSub:async(req, res)=>{
    try{
     //const examDateDetail=  await examDateAndSubModel.findOne({$and:[{ examYear : req.body.selectedSession},{examType: req.body.selectedExamType}]})
     const examDateDetail=  await examDateAndSubModel.find({})
      if(examDateDetail, examDateDetail.length>0){
       await examDateAndSubModel.findOneAndUpdate(
        {'_id':examDateDetail[0]._id},
        // {$and:[
        //   { examYear : req.body.selectedSession},
        //   {examType: req.body.selectedExamType}
        // ]},
        {examDateAndSub:req.body.examDateAndSub, modified: new Date()});
      }else{
        const examData=new examDateAndSubModel({
          examYear:req.body.selectedSession,
          examType:req.body.selectedExamType,
          examDateAndSub: req.body.examDateAndSub,
          created: new Date(),
          modified:new Date()
        })
        await examData.save();
      }
      return res.status(200).json({
        success: true,
        message: "Exam data created successfully.",
      })
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  getExamPermission :async(req, res)=>{
    try{
          const adminUser = await userModel.findOne({$and:[{'userInfo.userId':req.query.userId},{deleted:false},{'userInfo.roleName':{$in:['ADMIN','TOPADMIN']}}]})
          const getExamsData= await examModel.findOne({$and:[{deleted:false, primary:true}]})
            const resultEntryPermission= await resultEntryPerModel.findOne({$and:[{deleted:false, userId:req.query.userId}]}) 
          if(adminUser && getExamsData){
            const permission={
              classAllowed :classList,
              subjectsAllowed : subjectList,
              entry:true
            }
            let sendExamsData={
              permission:permission,
              examsData:getExamsData
            }
            if(adminUser.userInfo.roleName==='TOPADMIN'){
              return res.status(200).json({
                success: true,
                message: "Result entry permission data get successfully.",
                data: sendExamsData 
              })
            }
            if(adminUser.userInfo.roleName==='ADMIN' &&  getExamsData.adminAllowed){
              return res.status(200).json({
                success: true,
                message: "Result entry permission data get successfully.",
                data: sendExamsData 
              })
            }else{
              return res.status(200).json({
                success: false,
                message: "Result entry permission not allowed. Please contact to admin.", 
              })
            }
          }else{
            if(resultEntryPermission && getExamsData){
              const sendExamsData={
                permission:resultEntryPermission,
                examsData:getExamsData
              }
              return res.status(200).json({
                success: true,
                message: "Result entry permission data get successfully.",
                data: sendExamsData 
              })
      
            }else{
              return res.status(200).json({
                success: false,
                message: "Result entry permission not allowed. Please contact to admin.", 
              })
            }
          }
     
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  createResultEntryPermission: async(req, res)=>{
    try{
      const checkAlreadyExist = await resultEntryPerModel.findOne({userId:req.body.teacherId});
      if(!checkAlreadyExist){
        const resultEntryPerData= new resultEntryPerModel({
          userId:req.body.teacherId,
          // subjectsAllowed:req.body.subjectsAllowed,
          // classAllowed:req.body.classAllowed,
          allowedList:req.body.allowedList
        })
        const newResultEntryPer = await resultEntryPerData.save();
        if(newResultEntryPer){
          return res.status(200).json({
            success: true,
            message: "Result entry permisssion created successfully.",
          })
        }else{
          return res.status(200).json({
            success: false,
            message: "Result entry permisssion not created.",
          })
        }
     
      }else{
        return res.status(200).json({
          success: false,
          message: "Already Result Entry Permission created.",
        })
      }
   
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  getResultEntryPermission: async(req, res)=>{
    try{
      const getResultEntryPerData = await resultEntryPerModel.find({});
      if(getResultEntryPerData && getResultEntryPerData){
        return res.status(200).json({
          success: true,
          message: "Result entry permisssion get successfully.",
          data:getResultEntryPerData
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Result entry permisssion not found.",
        })
      }
    }catch(err){
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  updateResultEntryPermission: async (req, res) => {
    try {
      let newUpdate=null
      if(req.body.key==='entry'){
        newUpdate= await resultEntryPerModel.findOneAndUpdate({_id:req.body.resultEntryPerId},{entry:req.body.value, modified: new Date()});
      }
      if(req.body.key==='update'){
       let resultEntryPerData= await resultEntryPerModel.findOne({$and:[{_id:req.body.resultEntryPerId}]})
      //  console.log("resultEntryPerData", resultEntryPerData,)
      //  console.log("req.body.allowedList", req.body.allowedList,)
        resultEntryPerData.allowedList = req.body.allowedList,
        resultEntryPerData.modified = new Date

       newUpdate= await resultEntryPerModel.findOneAndUpdate({$and:[{_id:req.body.resultEntryPerId}]},resultEntryPerData);
      }
      if(newUpdate){
        return res.status(200).json({
          success: true,
          message: "Updated successfully."
        });
      }else{
        return res.status(200).json({
          success: false,
          message: 'Not updated, try agian',
        });
      }

     
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },
  deleteResultEntryPermission: async(req, res)=>{
    try{
      const deleted = await resultEntryPerModel.deleteOne({_id:req.params.id});
      if(deleted){
        return res.status(200).json({
          success: true,
          message: "Delated successfully.",
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Not Delated",
        })
      }
  
    }catch(err){
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  getAdminDashboardData:async(req, res)=>{
    try{
      let dashBoardData={}
      let todayTransaction={
        totalCredit: 0,
        toatlDebit:0,
        onlineCredit:0,
        cashCredit:0,
        cashDebit: 0
      }
      const todayDate = req.query.todayDate
      //console.log("todayDateeeeeeeeeeeeeeeee",  todayDate)
      const totalStudent= await userModel.find({$and:[activeParam, {'userInfo.roleName': 'STUDENT'}]}).countDocuments()
      const totalTeacher= await userModel.find({$and:[activeParam, {'userInfo.roleName': 'TEACHER'}]}).countDocuments()
      let date = new Date(todayDate)
      let date_end = new Date(todayDate)
      let startDate = new Date(date.setDate(date.getDate()));
      let endDate= new Date(date_end.setDate(date_end.getDate()+1))
      startDate.setUTCHours(18);
      startDate.setUTCMinutes(30);
      startDate.setSeconds(0);
      startDate.setMilliseconds(0);
      endDate.setUTCHours(18);
      endDate.setUTCMinutes(30);
      endDate.setSeconds(0);
      endDate.setMilliseconds(0);
      // const todayParams = {
      //     'created': {
      //         "$gte": startDate,
      //         "$lte":  endDate
      //     }
      // };
      const invoiceTodayParams = {
        $expr: {
          $and: [
              { $gte: [{ $toDate: "$invoiceInfo.submittedDate" }, startDate] },
              { $lte: [{ $toDate: "$invoiceInfo.submittedDate" }, endDate] }
          ]
        }
      };
      console.log(JSON.stringify(invoiceTodayParams))
 
      const birthDayUser=  await userModel.aggregate([
        { 
          $match: {
            $expr: {
              $and: [
                { $eq: [{ $dayOfMonth: '$userInfo.dob' }, 
                  { $dayOfMonth: {
                    date: new Date(),
                    timezone: "Asia/Kolkata"
                    } 
                  }
                  ] 
                },
                { $eq: [{ $month: '$userInfo.dob' },
                  { 
                    $month: 
                    {
                    date: new Date(),
                    timezone: "Asia/Kolkata"
                    } 
                  }
                  ] 
                },
              ],
            },
          }
        }
      ])
       const todayInvoice = await  invoiceModel.find({$and:[{deleted:false},invoiceTodayParams]})
       console.log("todayInvoice",todayInvoice)
       if(todayInvoice && todayInvoice.length>0){
          for (const it of todayInvoice) {
                if(it.transactionType && it.transactionType==='credit'){
                 todayTransaction.totalCredit= Number(todayTransaction.totalCredit)+ Number(it.amount)
                   if(it.invoiceInfo && it.invoiceInfo.payment && it.invoiceInfo.payment.length>0){
                      for (const payInfo of it.invoiceInfo.payment) {
                          if(payInfo && payInfo.payModeId.toString()==='Cash'){
                            todayTransaction.cashCredit = Number(todayTransaction.cashCredit) + Number(payInfo.amount)
                          }
                          if(payInfo && payInfo.payModeId.toString()!=='Cash'){
                            todayTransaction.onlineCredit = Number(todayTransaction.onlineCredit) + Number(payInfo.amount)
                          }
                      }
                  }
              }
          }
        }

      // const  filterParamsTxLedger = [
      //     {$match: {$and:[{$or:[{'otherInformation.system_mode': {$in:[system_mode,system_mode.toLowerCase()]}},{'app_mode':{$in:[system_mode,system_mode.toLowerCase()]}}]},{$or:[{'otherInformation.helox_type':true},{'capture_type':'api'}]}]}},
      //     {
      //         $group: {
      //             _id: {
      //                 year: {$year:{$toDate: '$otherInformation.submitingData'}},
      //                 month: {$month: {$toDate: '$otherInformation.submitingData'}},
      //                 day: {$dayOfMonth: {$toDate: '$otherInformation.submitingData'}}
      //             },
      //             count: {$sum: 1},
      //             "salesAmount": {$sum: { $toDouble:'$billingInformation.initialAmount'}},
      //             "salesCount": {$sum: {$cond: [{$gt: ['$billingInformation.initialAmount', 0]}, {$sum: 1}, 0]}},
      //             'budtenderAmount': {$sum: {$cond: [{$gt:['$billingInformation.budtenderTipAmount', 0]},'$billingInformation.budtenderTipAmount',0] }},
      //             'budtenderCount': {$sum: {$cond: [{$gt:['$billingInformation.budtenderTipAmount', 0]},{$sum:1},0] }},
      //             'driverAmount': {$sum: {$cond: [{$gt:['$billingInformation.driverTipAmount', 0]},'$billingInformation.driverTipAmount',0] }},
      //             'driverCount': {$sum: {$cond: [{$gt:['$billingInformation.driverTipAmount', 0]},{$sum:1},0] }},
      //         },

      //     },
      //     //{$sort:{'_id':-1}}
      // ]
       
      

      dashBoardData={
        totalStudent:totalStudent,
        totalTeacher:totalTeacher,
        todayBirthday:birthDayUser,
        todayTransaction:todayTransaction
      }

      if(dashBoardData){
        return res.status(200).json({ 
          success: true,
          message: "get dashboard data successfully.",
          dashboardData:dashBoardData
        });
      }
    }catch(err){
      console.log(err);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

  },
  upgradeClass: async (req, res) => {
    try {
      let totalStudent = await userModel.find(  {$and: 
        [ 
          activeParam,
          {'userInfo.roleName':'STUDENT'},
          {'userInfo.class':req.body.selectedClass},
        ]
      })
      if(totalStudent && totalStudent.length>0){
        for(student of totalStudent){
          // session add karna hai
          // old 10 class ke liye puran seeion rhne dena hai
           await userModel.findOneAndUpdate({_id:student._id},{'userInfo.class':req.body.upgradeClass})
             
          }
      }
        
      return res.status(200).json({
        success: true,
        message: "class upgraded successfully",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  createList: async (req, res) => {
    try{
      let newListCreated=''
      if(req.params.name==='vehicleList'){
        const newInfo= new vehicleModel({
          ...req.body
        })
        newListCreated = await newInfo.save();
      }
      if(req.params.name==='busRouteFareList'){
        const newInfo= new vehicleRouteFareModel({
          ...req.body
        })
        newListCreated = await newInfo.save();
      }
      if(req.params.name==='monthlyFeeList'){
        const newInfo= new monthlyFeeListModel({
          ...req.body
        })
        newListCreated = await newInfo.save();
      }
      if(req.params.name==='createPayOption'){
        const newInfo= new payOptionModel({
          ...req.body
        })
        newListCreated = await newInfo.save();
      }
      if(newListCreated){
        return res.status(200).json({
          success: true,
          message: "created successfully.",
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Not created list, Please try again!",
        })
      }
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  updateList: async (req, res) => {
    try{
      let updateList=''
      if(req.params.name==='vehicleList'){
        updateList = await  vehicleModel.findByIdAndUpdate({_id: req.params.id},req.body)
      }

      if(req.params.name==='busRouteFareList'){
        updateList = await  vehicleRouteFareModel.findByIdAndUpdate({_id: req.params.id},req.body)
      }

      if(req.params.name==='monthlyFeeList'){
        updateList = await  monthlyFeeListModel.findByIdAndUpdate({_id: req.params.id},req.body)
      }

      if(req.params.name==='updatePayOption'){
        updateList = await  payOptionModel.findByIdAndUpdate({_id: req.params.id},req.body)
      }

      if(updateList){
        return res.status(200).json({
          success: true,
          message: "Updated successfully.",
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Not updated list, Please try again!",
        })
      }
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  getAllList: async (req, res) => {
    try{
      let vehicleList= await vehicleModel.find()
      let busRouteFareList= await vehicleRouteFareModel.find()
      let monthlyFeeList= await monthlyFeeListModel.find()
      let payOptionList= await payOptionModel.find()
      let paymentRecieverUserList = await userModel.find({$and:[activeParam,{'userInfo.roleName':{$in:['ADMIN','ACCOUNTANT']}},{'userInfo.userId':{$nin:['topadmin']}}]}) // 918732 Anshu kumar id
      let allStudentUserId = await userModel.find({$and:[activeParam,{'userInfo.roleName':'STUDENT'}]},{"userInfo.userId": 1})
      return res.status(200).json({
        success: true,
        message: "Get list successfully.",
        data:{
          vehicleList,
          busRouteFareList,
          monthlyFeeList,
          payOptionList,
          paymentRecieverUserList,
          allStudentUserIdList : allStudentUserId && allStudentUserId .length>0 ?allStudentUserId.map(data=> {return {label: data.userInfo.userId,value: data.userInfo.userId}}):[]
        }
      })
  
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  addPayment: async (req, res) => {
    try{
      let paymentAdded=null
      const newInvoiceIdGen = await newInvoiceIdGenrate()
      let newInvoiceInfo= new invoiceModel({})
      newInvoiceInfo['invoiceInfo'] = {...req.body}
      newInvoiceInfo['invoiceType'] ='MONTHLY'
      newInvoiceInfo['transactionType'] ='credit'
      newInvoiceInfo['paidStatus'] = true
      newInvoiceInfo['userId'] = req.body.userId,
      newInvoiceInfo['class'] = req.body.class,
      newInvoiceInfo['amount'] = req.body.paidAmount
      newInvoiceInfo['invoiceId'] = newInvoiceIdGen
      newInvoiceInfo['insertedId'] = req.body.insertedId
      newInvoiceInfo['session']= req.body.session
      const newInvoiceCreate = await newInvoiceInfo.save();
      if(newInvoiceCreate){
        let paymentFound =  await paymentModel.findOne({userId: req.body.userId})
        if(paymentFound){
          //console.log("paymentFound", paymentFound)
            for(const data of req.body.feeList){
              if(paymentFound[data.month.toLowerCase()] && paymentFound[data.month.toLowerCase()].paidStatus===true){
               
                 res.status(200).json({
                    success: false,
                    message: `Payment is already done of this "${data.month}" month.`,
                  })
                  await invoiceModel.deleteOne({_id:newInvoiceCreate._id}) 
                  return
                }
                else{
                  //console.log("hhhhhhhhhhh")
                  paymentFound[data.month.toLowerCase()]={
                    monthlyFee: data.monthlyFee,
                    busFee:  data.busFee? data.busFee:0,
                    busRouteId : data.busRouteId? data.busRouteId:0,
                    paymentRecieverId: req.body.paymentRecieverId,
                    paidStatus: true,
                    submittedDate : req.body.submittedDate,
                    invoiceId: newInvoiceCreate.invoiceId,
                    receiptNumber: req.body.receiptNumber 
                  }
                }
            }
            paymentFound['dueAmount'] = req.body.dueAmount? req.body.dueAmount:0
            paymentFound['excessAmount'] = req.body.excessAmount? req.body.excessAmount:0
            paymentFound['totalConcession']  = parseInt(paymentFound.totalConcession)+ parseInt(req.body.concession ? req.body.concession:0)
            paymentFound['totalFineAmount']  = parseInt(paymentFound.totalFineAmount)+ parseInt(req.body.fineAmount? req.body.fineAmount:0)
            // paymentFound['totalPaidAmount'] =  parseInt(paymentFound.totalPaidAmount)+ parseInt(req.body.paidAmount)
            // paymentFound['totalAmount'] =  parseInt(paymentFound.totalAmount) + parseInt(req.body.totalAmount)
            paymentFound.modified = new Date()
            paymentAdded = await paymentModel.findByIdAndUpdate({_id: paymentFound._id},paymentFound)
        }else{
          let newPaymentInfo= new paymentModel({})
          req.body.feeList.forEach(data=>
            newPaymentInfo[data.month.toLowerCase()]={
                  monthlyFee: data.monthlyFee,
                  busFee:  data.busFee? data.busFee:0,
                  busRouteId : data.busRouteId? data.busRouteId:0,
                  paymentRecieverId: req.body.paymentRecieverId,
                  submittedDate : req.body.submittedDate,
                  paidStatus: true,
                  invoiceId: newInvoiceCreate.invoiceId,
                  receiptNumber: req.body.receiptNumber 
            }
          )
          newPaymentInfo['dueAmount'] = req.body.dueAmount? req.body.dueAmount:0
          newPaymentInfo['excessAmount'] = req.body.excessAmount? req.body.excessAmount:0
          newPaymentInfo['totalConcession'] = req.body.concession? req.body.concession:0
          newPaymentInfo['totalFineAmount']= req.body.fineAmount? req.body.fineAmount:0
          newPaymentInfo['userId'] = req.body.userId
          newPaymentInfo['session'] = req.body.session
          // newPaymentInfo['totalPaidAmount'] = req.body.paidAmount
          // newPaymentInfo['totalAmount'] = req.body.totalAmount
  
          paymentAdded = await newPaymentInfo.save();
        }
      }
      if(paymentAdded){
        return res.status(200).json({
          success: true,
          message: "Payment Added successfully.",
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Payment not added, Please try again!",
        })
      }
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  gePaymentDetail: async (req, res) => {
    try{

      let searchStr = req.query.searchStr? (req.query.searchStr).trim():''
      let searchParam={}
      let userIdParam={}
      let classParam={'userInfo.class':'1 A'}
      const roleParam={'userInfo.roleName':'STUDENT'}
      if(req.query.selectedClass){
        classParam={'userInfo.class':req.query.selectedClass}
      }

      if (searchStr && searchStr !== "" && searchStr !== undefined && searchStr !== null){
        searchParam={
          $or:[
            {'userInfo.fullName': new RegExp(searchStr, 'i')},
            {'userInfo.fatherName': new RegExp(searchStr, 'i')},
            {'userInfo.motherName': new RegExp(searchStr, 'i')},
            {'userInfo.email': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber1': new RegExp(searchStr, 'i')},
            {'userInfo.phoneNumber2': new RegExp(searchStr, 'i')},
            {'userInfo.aadharNumber':new RegExp(searchStr, 'i')},
            {'userInfo.userId':new RegExp(searchStr, 'i')}
          ]
        }
      }
      if(req.query.userId){
          classParam={}
          searchParam={}
          userIdParam={'userInfo.userId': req.query.userId}
      }
      
      let students= await userModel.find({$and:[ activeParam, classParam, roleParam, searchParam, userIdParam]})
      let busRouteFareList= await vehicleRouteFareModel.find()
      let monthlyFeeList= await monthlyFeeListModel.find()
      //let payOptionList= await payOptionModel.find()
   
      //let paymentRecieverUserList = await userModel.find({$and:[activeParam,{'userInfo.roleName':{$in:['ADMIN','ACCOUNTANT']}},{'userInfo.userId':{$nin:['918732']}}]}) 
      if(students && students.length){
        const userIds= students.map(data=> data.userInfo.userId)
        let payDetail= await paymentModel.find({userId:{$in:[...userIds]}})
      
        const newList=  await Promise.all(students.map(async(sData)=> {
          let condInvParam ={$and:[{'userId': sData.userInfo.userId},{'session': req.query.session},{deleted: false},{paidStatus: true}]}
          const invoiceData = await invoiceModel.find(condInvParam)
          let userPayDetail =(payDetail && payDetail.length)? payDetail.find(data=> data.userId ===sData.userInfo.userId): undefined
                                             //(sData, userPayDetail, monthlyFeeList, busRouteFareList)
          const monthPayDetail= getMonthPayData(sData, userPayDetail, monthlyFeeList, busRouteFareList)
          return{
            sData,
            userPayDetail: userPayDetail? userPayDetail: undefined,
            ...monthPayDetail,
            preDueAmount: userPayDetail && userPayDetail.dueAmount?userPayDetail.dueAmount:0,
            preExcessAmount: userPayDetail && userPayDetail.excessAmount?userPayDetail.excessAmount:0,   
            userInvoiceDetail: invoiceData
          }
        }))
        return res.status(200).json({
          success: true,
          message: "Payment detail get successfully.",
          data: newList
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Payment detail not found"
        })
      }
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  getAllInvoice: async(req, res)=>{
    try{
      let invoiceData
      let limit = (req.query.limit && parseInt(req.query.limit) > 0 )? parseInt(req.query.limit):10
      let pageNumber = req.query.pageNumber ? parseInt(req.query.pageNumber) : 0 ;
      let totalCount=0
      let order = {'invoiceInfo.submittedDate':"asc"}

      if(req.query.invoiceId){
        invoiceData= await invoiceModel.find({invoiceId:req.query.invoiceId })
      }else{
        order={'created':'desc'}
        totalCount= await invoiceModel.find({}).countDocuments()
        invoiceData= await invoiceModel.find({}).sort(order).limit(limit).skip(limit * pageNumber)
      }
      if(invoiceData && invoiceData.length>0){
        let allInvoice=[]
          for (let it of invoiceData) {
            if(it.invoiceInfo.userId && it.invoiceType==='MONTHLY'){
              const userData =  await userModel.findOne({'userInfo.userId': it.invoiceInfo.userId})
              it.invoiceInfo['userData']= userData
            }
              if(it.invoiceInfo.paymentRecieverId && it.invoiceType==='MONTHLY'){
              const recieverData = await userModel.findOne({'_id': it.invoiceInfo.paymentRecieverId})
                //console.log("recieverDatarecieverDatarecieverData", recieverData)
                it.invoiceInfo['recieverName'] = recieverData && recieverData.userInfo &&recieverData.userInfo.fullName? recieverData.userInfo.fullName:'N/A'
              }
             allInvoice.push(it)
          }
        return res.status(200).json({
          success: true,
          message: "Invoice detail get successfully.",
          data: allInvoice.sort((a,b)=> new Date(b.invoiceInfo.submittedDate) - new Date(a.invoiceInfo.submittedDate)),
          pageSize:totalCount>0? Math.floor(totalCount/limit)+1:0,
          totalCount:totalCount
        })
      }else{
        return res.status(200).json({
          success: false,
          message: "Invoice detail not found"
        })
      }
    }catch(err){
      console.log(err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },
  getInvoicesByUserId: async(req, res)=>{
    try{

      //const invoiceAll= await invoiceModel.find({})
     
      // let invIds=[]
      // for (const it of invoiceAll) {
      //     if(it.invoiceInfo.paidAmount!==it.invoiceInfo.totalGrandAmount){
      //       invIds.push(it.userId)
      //     }
      // }
      //console.log("invIdsinvIdsinvIds", new Set( invIds))
        let condParam ={$and:[{'userId': req.query.userId},{'session': req.query.session}]}
        //let condParam ={$and:[{'userId': req.query.userId}]}

        const invoiceData = await invoiceModel.find(condParam)
          return res.status(200).json({
            success: true,
            message: "Invoice detail get successfully.",
            data: invoiceData
          })
      }catch(err){
        console.log(err)
        return res.status(400).json({
          success: false,
          message: err.message,
        })
      }
  },

  deleteTransaction:async(req, res)=>{
        try {
          await paymentModel.updateMany({},
              
                { $set: {session:"2023-24"} }
              
            )
          const invoiceData= await invoiceModel.findOne({invoiceId: req.body.invoiceId})
          if(invoiceData && invoiceData.invoiceType==='MONTHLY' && req.body.session){
            const paymentData= await paymentModel.findOne({$and:[{'userId': invoiceData.userId},{session: req.body.session}]})
            if(paymentData){
              let copyOfPaymentData= JSON.parse(JSON.stringify(paymentData))
              let unsetMonthParam={$unset:{}}
              for (const it of invoiceData.invoiceInfo.feeList) {
                  
                  //delete copyOfPaymentData[it.month]
              }
              copyOfPaymentData.dueAmount = Number(copyOfPaymentData.dueAmount) - Number(invoiceData.invoiceInfo.dueAmount)
              copyOfPaymentData.excessAmount = Number(copyOfPaymentData.excessAmount) - Number(invoiceData.invoiceInfo.dueAmount)
              copyOfPaymentData.totalFineAmount = Number(copyOfPaymentData.totalFineAmount) - Number(invoiceData.invoiceInfo.fineAmount)

              console.log("paymentDatapaymentData",copyOfPaymentData)

              const updatedPayement = await paymentModel.findOneAndUpdate({'_id': paymentData._id},copyOfPaymentData)
              if(updatedPayement){
                  await invoiceModel.findOneAndUpdate({'_id': invoiceData._id},{deleted: true})
                  return res.status(200).json({
                    success: true,
                    message: "payment updated successfully"
                  })
              }else{
                return res.status(200).json({
                  success: false,
                  message: "payment not updated."
                })
              }
            }else{
              return res.status(200).json({
                success: false,
                message: "payment data not found."
              })
            }

          }else{
            return res.status(200).json({
              success: false,
              message: "Invoice detail not found."
            })
          }
        } catch (err) {
          console.log(err)
          return res.status(400).json({
            success: false,
            message: err.message,
          })
        }
  },

  createBuckup: async (req, res) => {
    sendDailyBackupEmail()

    // let url = URL;
    // let csv

    // mongodb.connect(
    //   url,
    //   { useNewUrlParser: true, useUnifiedTopology: true },
    //   (err, client) => {
    //     if (err) throw err;
    
    //     client
    //       .db("bmms")
    //       .collection("users")
    //       .find({})
    //       .toArray((err, data) => {
    //         if (err) throw err;
            
    //         console.log(data);
    //         const ws = fs.createWriteStream("users.csv");
    //         // TODO: write data to CSV file
    //         csv = fastcsv
    //         .write(data, { headers: true })
    //         .on("finish", function() {
    //           console.log("Write to users.csv successfully!");
    //         })
    //         .pipe(ws);
    //          //sendDailyBackupEmail(data)
    //         client.close();
    //       });

    //       res.setHeader('Content-disposition', 'attachment; filename=' + 'users.csv');
    //       res.set('Content-Type', 'text/csv');
    //       res.status(200).send(csv);
    //   }
    // );

    return res.status(200).json({
      success: false,
      message: "backup created"
    })

    // try {
    //   // console.log("response", response);
    //   const conn = mongoose.createConnection(URL, {
    //     useNewUrlParser: true,
    //     useUnifiedTopology: true,
    //   });
    //   conn.on("open", function () {
    //     conn.db.listCollections().toArray(function (err, allCollectionNames) {
    //       if (err) {
    //         console.log(err);
    //         return res.status(200).json({
    //           success: false,
    //           message: "Backup collection not get.",
    //         });
    //       }
    //       // let collections = allCollectionNames
    //       //   .map((data) => {
    //       //     return { dbName: data.name };
    //       //   })
    //       //   .filter((fdata) => fdata.dbName.includes("FundingSource_"));
    //       conn.close();

    //       return res.status(200).json({
    //         success: true,
    //         message: "Backup collection get Successfully",
    //         allCollectionNames,
    //       });
    //     });
    //   });
    // } catch (err) {
    //   console.log(err);
    //   return res.status(400).json({
    //     success: false,
    //     message: "Something went wrong",
    //     error: err.response,
    //   });
    // }

  //   // try {
  //   //   let curr_date1 = moment.tz(Date.now(), "Asia/Kolkata");
  //   //   let dd = curr_date1.date() - 1;
  //   //   let mm = curr_date1.month() + 1;
  //   //   let yyyy = curr_date1.year();
  //   //   let collectionName = `users${dd}_${mm}_${yyyy}`;
  //   //   userModel.aggregate([{ $out: collectionName }], (err, response) => {
  //   //     if (err) {
  //   //       console.log("err", err);
  //   //       return res.status(200).json({
  //   //         success: false,
  //   //         message: "Backup not created.",
  //   //       });
  //   //     } else {
  //   //       const conn = mongoose.createConnection(URL, {
  //   //         useNewUrlParser: true,
  //   //         useUnifiedTopology: true,
  //   //       });
  //   //       conn.on("open", function () {
  //   //         conn.db
  //   //           .listCollections()
  //   //           .toArray(function (err, allCollectionNames) {
  //   //             if (err) {
  //   //               console.log(err);
  //   //               return res.status(200).json({
  //   //                 success: false,
  //   //                 message: "Backup not created.",
  //   //               });
  //   //             }
  //   //             // let collections = allCollectionNames
  //   //             //   .map((data) => data.name)
  //   //             //   .filter((fdata) => fdata.includes("FundingSource_"));
  //   //             conn.close();
  //   //             // let todayCollection = collections.find(
  //   //             //   (data) => data == collectionName
  //   //             // );
  //   //             // console.log("todayCollection", todayCollection);
  //   //             if (allCollectionNames) {
  //   //               return res.status(200).json({
  //   //                 success: true,
  //   //                 message: "Backup Successfully",
  //   //                 allCollectionNames,
  //   //               });
  //   //             } else {
  //   //               return res.status(200).json({
  //   //                 success: false,
  //   //                 message: "Backup not created.",
  //   //               });
  //   //             }
  //   //           });
  //   //       });
  //   //     }
  //   //   });
  //   // } catch (err) {
  //   //   console.log(err);
  //   //   return res.status(400).json({
  //   //     success: false,
  //   //     message: "Something went wrong",
  //   //     error: err.response,
  //   //   });
  //   // }
  },

  


  /// blog website
  createBlogPost: async (req, res) => {

    let blogReqBody = req.body
    try {
      // function slugify(str) {
      //   return String(str)
      //     .normalize('NFKD') // split accented characters into their base characters and diacritical marks
      //     .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
      //     .trim() // trim leading or trailing whitespace
      //     .toLowerCase() // convert to lowercase
      //     .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
      //     .replace(/\s+/g, '-') // replace spaces with hyphens
      //     .replace(/-+/g, '-'); // remove consecutive hyphens
      // }
      let title = blogReqBody.title
      let slugTitle= ''
      if(!title){
        return res.status(400).json({
          success: false,
          message: "Title required.",
        });
      }
      if(title){
        slugTitle = slugify(title, {
          replacement: '-',  // replace spaces with replacement character, defaults to `-`
          remove: undefined, // remove characters that match regex, defaults to `undefined`
          lower: true,       // convert to lower case, defaults to `false`
          strict: false,     // strip special characters except replacement, defaults to `false`
          locale: 'en',      // language code of the locale to use
          trim: true,        // trim leading and trailing replacement chars, defaults to `true`
          remove: /[*+~.()'"!:@]/g       
        })
        if(slugTitle){
          const foundSlug= await blogModel.find({slugTitle:slugTitle})
          if(foundSlug && foundSlug.length>0){
            return res.status(400).json({
              success: false,
              message: "Title already exist.",
            });
          }
        }else{
          return res.status(400).json({
            success: false,
            message: "Title not proper string.",
          });
        }
      }
 
      blogReqBody['slugTitle']= slugTitle

      let newBlogPost = new blogModel(blogReqBody)
      //   {
      //     title:req.body.title,
      //     subTitle:req.body.subTitle,
      //     content:req.body.content,
      //     postImageUrl:req.body.postImageUrl,
      //     category:req.body.category,
      //   }
      // )
      await newBlogPost.save()
      return res.status(200).json({
        success: true,
        message: "New Blog Post created",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Blog Post not created.",
        error: error.message,
      });
    }
  },
  deleteBlogPost: async (req, res) => {
    try {
      const data= await blogModel.findOneAndDelete({_id:req.body.id})
      return res.status(200).json({
        success: true,
        message: "Delete Blog Post successfuly",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },

  updateBlogPost: async (req, res) => {
    try {
      const updateData= blogModel.findOneAndUpdate({_id:req.body.blogPostNumber},req.body)
      return res.status(200).json({
        success: true,
        message: "Blog Post updated",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  },


  //old apis
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
      return res.status(400).json({
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
