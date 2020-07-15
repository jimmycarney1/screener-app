import React, { Component } from "react";
import { render } from "react-dom";
//import "survey-react/survey.css"
import * as Survey from "survey-react"


class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      loaded: false,
      response: '',
      placeholder: "Loading"
    };
    this.onComplete = this.onComplete.bind(this);
  }

  componentDidMount() {
    fetch("https://screener-site.herokuapp.com/assessments/api/screeners/1")
      .then(response => {
        if (response.status > 400) {
          return this.setState(() => {
            return { placeholder: "Something went wrong!" };
          });
        }
        return response.json();
      })
      .then(data => {
        this.setState(() => {
          return {
            data,
            loaded: true,
            
          };
        });
      });
  }
  
  onComplete(survey, options){
    var output = {
      answers: []
    }
    // Loop through survey questions 
    for (var result_answer in survey.data){
      
      // Add each question in the expected format
      output["answers"].push({
        question_id: result_answer,
        value: survey.data[result_answer]
      })
    }
    var requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(output)
    }

    
    
    fetch("https://screener-site.herokuapp.com/assessments/api/bpds", requestOptions)
      .then(response => {
        if (response.status > 400) {
          return this.setState(() => {
            return { placeholder: "Something went wrong!" };
          });
        }
        return response.json();
      })
      .then(data => {


        // Loop through response and add surveys that the API returns
        var out_string = "Surveys to take next: "
        if (data.results.length == 0){
          out_string = "No more surveys to take :)"
        }
        else{ 
          for (var survey of data.results){
            out_string = out_string.concat(survey, ', ')
          }
        }
        this.setState({response: out_string}
        )
      });

    
  }
  
  render() {

    if (this.state.data.content != null){
      var json_obj = {
        title: this.state.data.content.display_name,
        showProgressBar: "bottom",
        goNextPageAutomatic: true,
        showNavigationButtons: false,
        pages:[],
        completedHtml: "<p>Survey Completed!</p>"
      
      }

      for (var section of this.state.data.content.sections){

        var choices = []
        // Add answers 
        for (var answer of section.answers){
          choices.push(
            {
              text: answer.title,
              value: answer.value
            }
          )
        }
        // Each question should start a new page
        for (var question of section.questions){
          var questions = []
            
          json_obj["pages"].push({
            title: section.title ,
            questions: [
              {
                type: "radiogroup",
                name: question.id,
                title: question.title,
                choices: choices,
                rows: questions
              }
  
            ]
          })
        }
      }

      // Create the survey
      var surveyRender = (
        <Survey.Survey
          json = {json_obj}
          showCompletedPage={true}
          onComplete ={this.onComplete}
        />
      )
    }
    
    return (
      
      <div>
        {this.state.data.full_name}
        <div>
          {surveyRender}

          {this.state.response}
        </div>
      </div>
    
    );
  }
}

export default App;

const container = document.getElementById("app");
render(<App />, container);