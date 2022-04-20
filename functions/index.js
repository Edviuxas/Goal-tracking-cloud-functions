const functions = require("firebase-functions");
const admin = require('firebase-admin');
const moment = require('moment');
moment.defaultFormat = "YYYY/MM/DD HH:mm:ss";
admin.initializeApp();
// admin.initializeApp({
//     credential: admin.credential.cert(
//         "C:/Users/Edvinas/Desktop/eee/Mokslai/Universitetas/BAIGIAMASIS DARBAS/Cloud functions/functions/goal-tracking-ccad5-32a5cbbcebd8.json"
//     ),
//     databaseURL: "http://localhost:9000/?ns=goal-tracking-ccad5-default-rtdb"
// });
const messaging = admin.messaging();

// exports.sendListenerPushNotification = functions.database.ref('Users/{userId}/').onWrite((data, context) => {
// 	const userId = context.params.userId;
//     const FCMToken = admin.database().ref(`Users/${userId}/fcmToken`).once('value');
//     // console.log('FCMToken: ' + FCMToken);
//     console.log('userId: ' + userId);

//     return FCMToken.then(result => {

//         var token_id = result.val();
//         // var tokens = ['fNqyWPD8TCerSPwKGm6kR2:APA91bHELVE083YIUw3-xs4LMoWf_WymQd1KtW7zvah0zAzcls_kMYALPwaVajMpzBkw13HbJSD44-SOWZK_PeQH_SLsNNOwoZLN3GAXszjQzGH7BrE5dlOmtVAB2U7Bb9E-v1hyV0Ca', 'f4HbZWVmTLuhlaNrUbdHzf:APA91bGMWUbNQbhUYhFviHHjR6_yCDz4IFCAUbTuGxCE-w_T0MtbvKyq7nEr7KRnaMl_agW_Y6sZ2GOMetdBHv1OKVZrSxIk3X0fyHtMQEurnCOU2tlSXn3pQ4t1VV80W7JKl_SAhdzH'];
    
//         // console.log(tokens);
    
//         // var str = eventSnapshot.message;
//         // console.log(eventSnapshot.from);
    
//         var payload = {
//             data: {
//                 title: "Reminder about a task",
//                 body: "Your due date for a task is coming up!"
//             }
//         };
    
//         // Send a message to devices subscribed to the provided topic.
//         return messaging.sendToDevice(token_id, payload).then(function (response) {
//                 // See the MessagingTopicResponse reference documentation for the
//                 // contents of response.
//                 console.log("Successfully sent message:", response);
//                 return;
//         })
//         .catch(function (error) {
//             console.log("Error sending message:", error);
//         });
    
//     });
// })

exports.scheduledFunction = functions.pubsub.schedule('0 */3 * * *').onRun(async (context) => {
    const userSnapshot = await admin.database().ref('/Users').once('value');

    var userIds = [];
    var tokens = [];
    var currentDate = moment().add(3, 'hours');
    userSnapshot.forEach((user) => {
        const uid = user.key;
        const fcmToken = user.child('fcmToken').val();
        console.log('fcmToken: ' + fcmToken);

        // userIds.push(uid);
        // tokens.push(fcmToken.val());
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
                                                // body: "Please notice that you are late!"
                                                body: "Due date is coming up for goal " + `"` + goalName + `"` + ", okr goal " + `"` + okrGoalName + `"`
                                            },
                                            token: fcmToken
                                        };
                                    } else {
                                        payload = {
                                            data: {
                                                title: "Your due date for a task is coming up!",
                                                // body: "Due date is coming up!"
                                                body: "Due date is coming up for goal " + `"` + goalName + `"` + ", okr goal " + `"` + okrGoalName + `"`
                                            },
                                            token: fcmToken
                                        };
                                    }
                            
                                    messaging.send(payload).then(function (response) {
                                        // See the MessagingTopicResponse reference documentation for the
                                        // contents of response.
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
        
        // console.log('uid: ' + uid + ' fcmToken: ' + fcmToken.val());
    });

    // for(let i = 0; i < userIds.length; i++) {
        // var payload = {
        //     data: {
        //         title: userIds[i],
        //         body: "Your due date for a task is coming up!"
        //     }
        // };

        // messaging.sendToDevice(tokens[i], payload).then(function (response) {
        //     // See the MessagingTopicResponse reference documentation for the
        //     // contents of response.
        //     console.log("Successfully sent message:", response);
        //     return;
        // })
        // .catch(function (error) {
        //     console.log("Error sending message:", error);
        // });
    // }
    // return snapshot.then(result => {
        
    //     console.log(result.val());
    // });
    return null;
});
