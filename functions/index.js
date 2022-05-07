const functions = require("firebase-functions");
const admin = require('firebase-admin');
const moment = require('moment');
moment.defaultFormat = "YYYY/MM/DD HH:mm:ss";
admin.initializeApp();
const messaging = admin.messaging();

exports.scheduledFunction = functions.pubsub.schedule('0 */3 * * *').onRun(async (context) => {
    const userSnapshot = await admin.database().ref('/Users').once('value');

    var currentDate = moment().add(3, 'hours');
    userSnapshot.forEach((user) => {
        const uid = user.key;
        const fcmToken = user.child('fcmToken').val();
        console.log('fcmToken: ' + fcmToken);

        const goalsSnapshotPromise = admin.database().ref(`Users/${uid}/Goals`).once('value');
        goalsSnapshotPromise.then((goalsSnapshot) => {
            goalsSnapshot.forEach((goal) => {
                const goalId = goal.key;
                const goalName = goal.child('goal').val();
                const notificationPeriod = goal.child('notificationPeriod').val();
                console.log('goalId: ' + goalId + ' notificationPeriod: ' + notificationPeriod);

                if (notificationPeriod != 'None' && notificationPeriod != null) {
                    var splittedNotificationPeriod = ((Number)(notificationPeriod.split(' ')[1]));
                    console.log('splittedNotificationPeriod: ' + splittedNotificationPeriod);

                    const okrSnapshotPromise = admin.database().ref(`Users/${uid}/Goals/${goalId}/okrGoals`).once('value');
                    okrSnapshotPromise.then((okrSnapshot) => {
                        okrSnapshot.forEach((okr) => {
                            const okrGoalId = okr.key;
                            const okrGoalName = okr.child('goal').val();
                            const dueDate = okr.child('dueDate').val();
                            const isDone = okr.child('done').val();
                            console.log('typeof isDone: ' + typeof(isDone));
                            console.log('isDone: ' + isDone);
                            var dueDateMoment = moment(dueDate, "YYYY/MM/DD");
                            console.log('dueDateMoment: ' + dueDateMoment);
                            var notificationLastSent = okr.child('notificationLastSent').val();
                            console.log('okrGoalId: ' + okrGoalId + ' notificationLastSent: ' + notificationLastSent);
                            
                            var diff = currentDate.diff(dueDateMoment, 'days');
                            if (diff > -1 && isDone != true) {
                                var shouldSendNotification = true;
                                if (notificationLastSent != null && notificationLastSent != 'n/a') {
                                    console.log('currentDate: ' + currentDate.format("YYYY/MM/DD HH:mm:ss") + ' notificationLastSent: ' + notificationLastSent);
                                    var duration = moment.duration(currentDate.diff(moment(notificationLastSent, moment.defaultFormat)));
                                    var hours = duration.asHours();
                                    console.log('hours: ' + hours);
                                    if (hours >= splittedNotificationPeriod) {
                                        shouldSendNotification = true;
                                    } else {
                                        shouldSendNotification = false;
                                        console.log('Not enough time has passed since the last notification');
                                    }
                                }
                                if (shouldSendNotification) {
                                    var payload;
                                    if (diff > 0) {
                                        payload = {
                                            data: {
                                                title: "You are late!",
                                                body: "Due date is coming up for goal " + `"` + goalName + `"` + ", okr goal " + `"` + okrGoalName + `"`
                                            },
                                            token: fcmToken
                                        };
                                    } else {
                                        payload = {
                                            data: {
                                                title: "Your due date for a task is coming up!",
                                                body: "Due date is coming up for goal " + `"` + goalName + `"` + ", okr goal " + `"` + okrGoalName + `"`
                                            },
                                            token: fcmToken
                                        };
                                    }
                            
                                    messaging.send(payload).then(function (response) {
                                        console.log('sent message to this token: ' + fcmToken);
                                        console.log("Successfully sent message:", response);
                                        moment.defaultFormat = "YYYY/MM/DD HH/mm";
                                        var currentDateTime = moment();
                                        return admin.database().ref(`Users/${uid}/Goals/${goalId}/okrGoals/${okrGoalId}/notificationLastSent`).set(currentDateTime.utcOffset("+0300").format("YYYY/MM/DD HH:mm"));
                                    })
                                    .catch(function (error) {
                                        console.log("Error sending message:", error);
                                    });
                                }
                                
                            } else {
                                console.log('Difference is more than 1 day')
                            }
                        });
                    });
                }    
            });
        })        
        
    });
    return null;
});
