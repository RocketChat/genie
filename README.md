# genie slash command
This extension app adds slash command genie to Rocket.Chat allowing to execute operations on the integrate Opsgenie.

## /genie list

Lists the open alerts.

## /genie get [tinyID]

Gets corresponding alert.

## /genie list teams

List teams.

## /genie alert [alert message] for [team1,team2,user1..]

Create alert with specified message and including list of teams and users as responders to the alert if passed.
(Pay attention the responders after the for keyword will be ignored if you are using an Essentials subscription. So untested yet.)

## /genie assign [tinyID tinyID2..] to [user]

It will assign the alert to the user.
(Pay attention this will be ignored if you are using an Essentials subscription. So untested yet.)
