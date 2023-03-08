# genie slash command
This extension app adds slash command genie to Rocket.Chat allowing to execute operations on Opsgenie.

It has 4 settings:
- API URL: The URL for the Opsgenie API (default to Atlassian cloud one https://api.opsgenie.com/v2/)
- API Key: The API Key for calling Opsgenie REST API.
- API Integration Key: The API Integration Key for Alerts REST API.
- Notify Only: In case you disable the responses are posted to the channel.

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

## /genie ack [tinyID tinyID2..]

Aknowledges corresponding alerts.

## /genie close [tinyID tinyID2..]

Closes corresponding alerts
