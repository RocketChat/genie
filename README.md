# genie slash command
This extension app adds slash command genie to Rocket.Chat allowing to execute operations on Opsgenie.

It has 4 settings:
- API URL: The URL for the Opsgenie API (default to Atlassian cloud one https://api.opsgenie.com/v2/)
- API Key Management: The API Key for calling Opsgenie REST API.
- Team Integration API Key: The API Integration Key for Alerts REST API.
- Notify Only: In case you disable the responses are posted to the channel.
- Opsgenie Domain: Your domain to be used for composing links.

## /genie ack [tinyID tinyID2..]

Aknowledges corresponding alerts.

## /genie close [tinyID tinyID2..]

Closes corresponding alerts

## /genie note [note] to [tinyID tinyID2..]

Add note to alerts.

## /genie addtag [tag1,tag2,..] to [tinyID tinyID2..]

Add tags to alerts.

## /genie ackall

Acknowledge all open alerts.

## /genie closeall

Close all open alerts.

## /genie assign [tinyID tinyID2..] to [user]

It will assign the alert to the user.
(Pay attention this will be ignored if you are using an Essentials subscription. So untested yet.)

## /genie own [tinyID tinyID2..]

Take ownership of alert.
(Pay attention this will be ignored if you are using an Essentials subscription. So untested yet.)

## /genie update priority to [P1, P2, P3, P4 or P5] for [tinyID]

Update priority of alert.

## /genie exec [action] on [tinyID tinyID2..]

Execute action.
(Pay attention this might be ignored if you are using an Essentials subscription. So untested yet.)

## /genie alert [alert message] for [team1,team2,user1..]

Create alert with specified message and including list of teams and users as responders to the alert if passed.
(Pay attention the responders after the for keyword will be ignored if you are using an Essentials subscription. So untested yet.)

## /genie get [tinyID]

Gets corresponding alert.

## /genie list

Lists the open alerts.

## /genie list integrations

List integrations.

## /genie list policies

List policies.

## /genie list teams

List teams.

## /genie enable integration/policy [id of policy/integration]

Enable Integration/Policy.

## /genie disable integration/policy [id of policy/integration]

Disable Integration/Policy.

## /genie list schedules

List all schedules.

## /genie whoisoncall [schedule id]

Retrieves oncall user information for the schedule passed. Else for all schedules.

