import mongoose from "mongoose"

const EmployeeDetailModel = new mongoose.Schema({
    employeeName: {
        type: mongoose.Schema.ObjectId,
        ref: "EName"
    }
})
export default mongoose.model('EmployeeDetailModel', EmployeeDetailModel)