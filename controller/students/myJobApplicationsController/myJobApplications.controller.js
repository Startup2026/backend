const async_handler = require("express-async-handler")
const Application = require("../../../models/application.model");
// Student Dashboard

const summary = async_handler(async (req, res) => {
    const { studentId } = req.params

    const totalApplied = await Application.countDocuments({ studentId });

    const totalShortlisting = await Application.aggregate([
        {
            $match: { status: "SHORTLISTED" },

        }, {
            $group: {
                $count: { $sum: 1 }
            }
        }
    ]
    );

    const totalPending = await Application.aggregate([
        {
            $match: { status: "PENDING" },

        }, {
            $group: {
                $count: { $sum: 1 }
            }
        }
    ]
    );

    return res.status(201).json({
        "data": [totalApplied, totalShortlisting, totalPending]
    })
});

module.exports = {
    summary
};