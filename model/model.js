
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var currentContestSchema = new Schema({
    ContestID:  String,
    Name: String,
    Date: String,
    CDName: String,
    District: String
}, {collection: 'CurrentContest'});
exports.currentContest = mongoose.model('CurrentContest', currentContestSchema);

var contestSchema = new Schema({
    ContestID:  String,
    Name: String,
    Date: String,
    IsPersisted: Boolean,
    ContestDir: String,
    CDName: String,
    CDAMA: String,
    District: String,
    PrelimAndFinalForAllClasses: Boolean,
    NormAllPrelims: Boolean,
    NormF3APrelims: Boolean,
    NormToPerfect: Boolean,
    SupportedClasses: [String]
}, {collection: 'Contest'});
exports.contest = mongoose.model('Contest', contestSchema);

var competitionClassSchema = new Schema({
    IsPersisted: Boolean,
    Name: String,
    AMAID: String,
    IsClassic: Boolean,
    IsUsingPersonalSchedule: Boolean,
    MaxPersonalK: Number,
    MasterScoreID: String,
    ManeuverList: {
        Schedule: [ {
            Name: String,
            KFactor:Number,
            MasterScoreID: String
        }]
    }
}, {collection:'CompetitionClass'});
competitionClassSchema.index({Name:1});
exports.competitionClass = mongoose.model('CompetitionClass', competitionClassSchema);

var contestantSchema = new Schema({
    IsPersisted: Boolean,
    RFID: String,
    PilotID: String,
    Name: String,
    AMANumber: String,
    ContestID: String,
    JudgeNumber: String,
    Class: String,
    Frequency: String,
    MasterScoreID: String,
    SequenceID: String
}, {collection:'Contestant'});
contestantSchema.index({ContestID:1});
contestantSchema.index({ContestID:1,Class:1});
contestantSchema.index({JudgeNumber:1});
exports.contestant = mongoose.model('Contestant', contestantSchema);

var judgeScoreSchema = new Schema({
    IsPersisted: Boolean,
    ScoreMatrix: String,
    JudgeId: String,
    SequenceOrder: Number,
    Score: Number,
    IsNotObserved: Boolean,
    IsProcessed: Boolean
}, {collection:'JudgeScore'});
//judgeScoreSchema.index({ScoreMatix:1, JudgeId:1});
//judgeScoreSchema.index({ScoreMatix:1, JudgeId:1, SequenceOrder:1});
exports.judgeScore = mongoose.model('JudgeScore', judgeScoreSchema);

var scoreMatrixSchema = new Schema({
    IsPersisted: Boolean,
    ContestantID: String,
    ContestID: String,
    Round: String,
    Class:String,
    Contestant: {
        IsPersisted: Boolean,
        Name: String,
        AMAID: String,
        IsClassic: Boolean,
        IsUsingPersonalSchedule: Boolean,
        MaxPersonalK: Number,
        ManeuverList: {
            Schedule: [ {
                Name: String,
                KFactor:Number
            }]
        }
    },
    JudgeNumber1: Number,
    JudgeNumber2: Number
}, {collection:'ScoreMatrix'});
scoreMatrixSchema.index({ContestID:1,Class:1,Round:1,ContestantID:1});
scoreMatrixSchema.index({Class:1,ContestantID:1,Round:1});
exports.scoreMatrix = mongoose.model('ScoreMatrix', scoreMatrixSchema);

var scoreMatrixRowSchema = new Schema({
    IsPersisted: Boolean,
    ScoreMatrix: String,
    Maneuver: String,
    MasterScoreID: String,
    Order: Number,
    Judge1Score: String,
    Judge2Score: String,
    Judge1Number: String,
    Judge2Number: String,
    Judge1ScoreObject: Schema.Types.Mixed,
    Judge2ScoreObject: Schema.Types.Mixed
}, {collection:'ScoreMatrixRow'});
scoreMatrixRowSchema.index({ScoreMatrix:1,Order:1});
scoreMatrixRowSchema.index({ScoreMatrix:1});
exports.scoreMatrixRow = mongoose.model('ScoreMatrixRow', scoreMatrixRowSchema);

var pilotSchema = new Schema({
    TimeStamp: Date,
    IsPersisted: Boolean,
    Name: String,
    Street: String,
    City: String,
    State: String,
    PostalCode: String,
    Country: String,
    PhoneNumber: String,
    Email: String,
    AMA: String,
    NSRCA: String,
    District: String,
    Class: String,
    Frequency: String,
    ExternalKey: String
}, {collection:'Pilot'});
pilotSchema.index({AMA:1});
exports.pilot = mongoose.model('Pilot', pilotSchema);


var contestDataSchema = new Schema({
    apiKey: String,
    contestDirector: String,
    contestName: String,
    date: String,
    district: String,
    nsrcaDistrict: String,
    location: String,
    contestID: String,
    classData: [ {
        code: String,
        name: String,
        contestants: [ {
            name: String,
            amaNumber: String,
            realAmaNumber: String,
            finalPlacement: Number,
            finalScore: Number,
            possibleScore: Number,
            actualScore: Number,
            percentOfPossible: Number,
            scoringData: [ {
                flightNumber: String,
                normalizedScore: Number,
                rawScore: Number,
                possibleScore: Number,
                percentOfPossible: Number,
                roundDropped: Boolean
            }]
        }]
    }]
}, {collection:'ContestData'});
contestDataSchema.virtual('year').get(function() {
    return this._year;
});
contestDataSchema.virtual('year').set(function(year) {
    return this._year = year;
});
contestDataSchema.set('toJSON', {
    virtuals: true
});
contestDataSchema.index({contestID:1});
exports.contestData = mongoose.model('ContestData', contestDataSchema);

var contestantResultSchema = new Schema({
    apiKey:String,
    fullName:String,
    amaNumber:String,
    className:String,
    finalPlacement:String,
    finalScore:Number,
    possibleScore:Number,
    actualScore:Number,
    percentOfPossible:Number,
    amaPoints:Number,
    contestID:String,
    realClassName:String,
    schedules: [{
        name:String,
        maneuvers:[{
            sequence:Number,
            name:String,
            kfactor:Number,
            flights:[{
                round:String,
                JudgeManeuverScores:[{
                    judgeId:String,
                    score:Number
                }]
            }]
        }],
        subTotals:[{score:String}],
        flightAverages:[{score:String}],
        percentages:[{score:String}]
    }]
},{collection:'ContestantResult'});
contestantResultSchema.index({contestID:1, amaNumber:1});
contestantResultSchema.index({contestID: 1, amaNumber:1, className:1});
contestantResultSchema.index({amaNumber:1, className:1});
exports.contestantResult = mongoose.model('ContestantResult', contestantResultSchema);

var apiUserSchema = new Schema({
    userName:String,
    apiKey:String,
    userEmail:String
});
apiUserSchema.index({apiKey:1});
exports.apiUser = mongoose.model('ApiUser', apiUserSchema);