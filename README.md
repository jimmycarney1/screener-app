Linkedin:

Link: [https://screener-site.herokuapp.com/frontend/](https://screener-site.herokuapp.com/frontend/)

I would recommend using a computer, as the formatting is a bit better (this is addressed below)

# Problem:
Standardized clinical assessments are often administered on paper. Patients are often asked to remember to fill these out in their own time. This leads to poor representation of the patient help. Furthermore, when recorded on paper, there has to be clinical time spent to upload the answers to a database, in order to store and analyze the data on a computer.

# Solution:
I built a client-facing web application that allows a patient to record an assessment with the convenience of the internet. This allows for timestamps of when the assessment is taken and removes the need to manually upload the assessment to a database, as it will be done as part of the application.

# What I left out, due to time constraints / requirements:

## UX/Design

### Mobile: This would be next on my &quot;to-do&quot; list:

Buttons need to be more vertically spaced. They are hard to press.

The radio-buttons need be removed (as per requirements).

### Web:

The title needs to be smaller

radio-buttons need be removed (as per requirements).

### API response
Due to no requirements for the workflow, response from the API (which surveys to take next) is just printed out onto the webpage.

Before production, this needs to be re-formatted, or removed.

# Technical Choices:
## Backend : Django

### Why I used it:

The &quot;out-of-the-box&quot; database support, CSRF/XSS support, and well-defined workflow.

I have experience with Flask, and Python is very familiar to me.

I am comfortable with backend architectures, and I felt confident I could learn how Django was configured.

### Tradeoffs:

I had not used Django before this project, and using a new framework took time to learn. However, I think it saved time in the long run, because of the features I could use that worked with little adjustment.

## Frontend: React/SurveyJS

### Why I used it:

SurveyJS seemed perfect for the requirements of the project. It was fast to set up, and very customizable.

React is an easy framework to get up and running. It is well documented (although SurveyJS did much of the work!)

### Tradeoffs:

SurveyJS is less flexible than if I were to create the survey myself.

SurveyJS is another external package that I am using and I have to trust that it is maintained/updated. This is a small worry.

## Storage: Postgres

### Why I used it:

Postgres is known to be stable, and easy to integrate with Django, as well as different hosting systems, so it seemed like a good choice.

### Trade-offs:

Using a file system would have been much quicker to set up and guarantees no headaches. However, this makes the product less secure, and much less scalable. Therefore, the tech debt seemed important to take on.

No-SQL superficially seems like an equally good choice, but to have all API responses in the same format is very useful for data science (which I believe should be a part of the long term plan for this project), and creating a structured database limits need for data-wrangling down the road.

## Hosting: Heroku

### Why I used it:

It is a very popular host, with plenty of Django support, Postgres support, and it is no-cost.

### Tradeoffs:

Although I did not know this when I chose to set up Heroku, I have found the system to be unstable. I would recommend upgrading the server before production.

I did not use Docker because it did not seem like the upside was worth the tech debt of setting it up. However, with more time this would be my preference, as microservices make for lightweight, stable, and flexible systems.

## Other choices : The BPDS endpoint

I &quot;hardcoded&quot; part of the solution for this API.

I created a specific endpoint for this assessment, instead of a general one (ie. Instead of &quot;api/<any id\>, I called &quot;api/bpds&quot;).

I also used a specific function for this endpoint (using global variables), instead of a generalized class, like the preferred Django workflow.

I used this &quot;anti-pattern&quot; workflow because I do not know if this end result (outputting more assessments to take) will be used again. If this is a specific solution, generalizing it would take up unnecessary space in the database, and add unnecessary tech-debt.

# Features I would add / other work:

## Users:

The API contract that was given in the instructions was such that users are not a part of the endpoint. Therefore, all surveys taken through this website are recorded in the database with no user. The backend is set up to have users, which also would add a new layer of authentication.

To test the back end, I created another little site inside of the app:

[https://screener-site.herokuapp.com/assessments/](https://screener-site.herokuapp.com/assessments/)

You can view the Homepage, but if you click &quot;List of screeners&quot; you will be locked out and taken to a login screen.

Put in &quot;jimmy&quot; and &quot;blueprint&quot; as username/password and you will see the list of screeners (and can view the assessment in plain text).

This part of the site exists to prove the backend/security works. However, it should not be considered part of the finished product and would be taken down before production.

# Code I&#39;m proud of:

Unfortunately, all of the work I&#39;m most proud of does not belong to me.

To discuss one such project, I developed an image enhancement algorithm. This was used by Garmin in their weather-radar Avionics.

On small planes, communication uses such bad internet that the quality of the radar&#39;s image was unusable, and Garmin opted not to include it as a feature. However, using my algorithm, the quality of the image became very close to as good as the image before it was compressed to be sent. There is a patent in-progress for this algorithm, which was entirely developed by me.
