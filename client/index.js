import React from 'react';
import { render } from 'react-dom';

import querystring from 'querystring';

var APP_ID = 1737594129877596;
const pageAccessToken = "EAAYsVSjgClwBAMZAGHQwY1KAbPPzsg5v54kps63kAY8FiTOWySYCdWY6KV0RrHWWdcA48kLGf3sXtvHIqx0skfi5VR2hHybzCUNJtnZBsPx3HhoUBbEZAQJRKl6V0kfRz3aghjIkXuVBKoc36bVww19RnPs9aaV7chZAb7UR2AZDZD";
var user = { // fix default values
  psid: 'user_2',
  tid: 'thread_1',
  name: 'river dash',
}

var client_id = '37c50fb2e74848a6841ddea2b1e195f2';
var redirect_uri = 'https://river-dash.glitch.me';
var refreshToken;
var accessToken;
var tokenRefreshAttempts = 0
var serverURL = 'https://river-dash.appspot.com';
let app = document.getElementById("app").innerHTML;

var threadType;

// keep for dev reasons only 
// when permission expires on desktop
class Client {
  init() {   
    let self = this
    var indexParams = querystring.parse(location.search); 
    if ('?code' in indexParams){ // this is a callback from spotify
      
      var code = indexParams['?code'];
      var url = serverURL + '/callback'
      var options = {
        method:'POST',
        body: JSON.stringify({
          code: code,
          tid: user.tid,
          psid: user.psid,
          name: user.name
        })
      }
      this.performSpotifyRequest(url, options)
      .then(function(json){
        accessToken = json.access_token;
        refreshToken = json.refresh_token;

        render(<App
               searchText=""
               searchResults={[]}
               showSearch={false}
               />, document.getElementById('app'));  
      });

    } else {
      var url = serverURL + '/user/' + user.psid 
      var options = {
        method:'GET',
      };
      let request = fetch(url, options);
      request.then(function(response){
        if (response.status == 200){
          return response.json()
        } else {
          alert("bad call to user")
          throw Error
        }
      }).then(function(json){

        accessToken = json.access_token;
        refreshToken = json.refresh_token;
        
        
        render(<App
               searchText=""
               searchResults={[]}
               showSearch={false}
               />, document.getElementById('app'));  


      }).catch(function(error){
        alert(error)
        render(<LoginButton />, document.getElementById('app'));
      })
    }
  }
  join(){

    let self = this
    var options = {
      method: 'POST',
      body: JSON.stringify({
        'tid': user.tid,
        'psid': user.psid,
        'name': user.name,
        'access_token': accessToken,
        'refresh_token': refreshToken
      })};
    var url = serverURL + '/join'


    fetch(url, options).then(function(response) {
//       if (response.status == 204){
//         //close webview then alert
//           window.alert("Make sure Spotify is opened. Play or pause any song to make sure it's actively running then let Tutti take over.")
//       }
      
      
    });
  }
  searchSpotify(query){
    var query = {
      q: query,
      type: 'track',
      limit: '5'
    };
    var url = 'https://api.spotify.com/v1/search?' + querystring.stringify(query);
    var options = {
        method: 'GET',
        headers: {
         'Accept': 'application/json',
         'Content-Type': 'application/json',
         'Authorization': 'Bearer ' + accessToken
        }    
    };
    return this.performSpotifyRequest(url, options)
  }
  getSavedSongs(){
    var url = serverURL + '/recommendations'
    var options = {
      method:'POST',
      body: JSON.stringify({
        psid: user.psid,
        tid: user.tid,
        access_token: accessToken
      })
    };
    return fetch(url, options).then((response) => {
      return response.json()
    }).then((json) => {
      console.log(json)
      return json
    })
  }
  playSong(trackInfoMap){
    let self = this
    var url = serverURL + '/play'
    var options = {
      method:'POST',
      body: JSON.stringify({
        psid: user.psid,
        tid: user.tid,
        uri: trackInfoMap['uri'],
        duration: trackInfoMap['duration'],
        id: trackInfoMap['id'],
        image: trackInfoMap['image'],
        artist: trackInfoMap['artist'],
        name: trackInfoMap['name']
        })
    };
    var messageToShare = {
      "attachment":{
         "type":"template",
         "payload":{
             "template_type":"generic",
             // "image_aspect_ratio": "square",
             "elements": [{
                 "title": trackInfoMap['name'],
                 "subtitle": trackInfoMap['artist'],
                 "image_url": trackInfoMap['image'],
                 "default_action":{
                     "type":"web_url",
                     "url": "https://river-dash.glitch.me",
                     "messenger_extensions":true,

                 },
                 "buttons":[{
                     "type":"web_url",
                     "url":"https://river-dash.glitch.me",
                     "title":"Join Session",
                     "messenger_extensions":true
                 }]
             }]
         }
      }
    }; 
    
    var shareMode = "current_thread"
    if (threadType == "USER_TO_PAGE"){
      shareMode = "broadcast" 
    }
    window.MessengerExtensions.beginShareFlow(function success(response) {
      // if(response.is_sent){
          // The user actually did share.
      if(response.is_sent){

        let request = fetch(url, options);
        request
        .then(function (response) {
          // need to clear search
          
          document.getElementById("searchInput").value = ""
          render(<App
                 searchText=""
                 searchResults={[]}
                 showSearch={false}
                 />, document.getElementById('app'));  

        })
      } 
    }, null,
    messageToShare,
    shareMode);    
  }

  performSpotifyRequest(url, options) {
    let self = this
    let request = fetch(url, options);
    return new Promise(function (resolve, reject) {
      request
      .then(function (response) {
        // figure out if bad token
        if (response.status == 404){ // eg no user
          throw Error;
        } else if (response.status !== 200){
          //bad token
          return self.renewToken()
          .then(
            function (){
            options.headers.Authorization = 'Bearer ' + accessToken
            return fetch(url, options)
              .then(function(response) {
                return response.json()
              })
          })
        } else {
          return response.json()      
        }
      }).then (function (json) {
        resolve(json)
      }).catch (function (err) {
        reject(err)
      })
    })
  }
  renewToken (){
    tokenRefreshAttempts++
    let self = this
    // also returns promise
    return fetch(serverURL + '/refresh', {
      method:'POST',
      body: JSON.stringify({
        psid: user.psid,
        refresh_token: refreshToken,
      })
    }).then(function(response){
      // set new token and possibly replay request
      self.tokenRefreshAttemps = 0
      return response.json()
    }).then(function(json){
      accessToken = json['access_token'];
    })
  }
}
// begin page
let client = new Client();

window.extAsyncInit = function() {
  window.MessengerExtensions.getContext(APP_ID, 
    function success(result){
      
      threadType = result.thread_type
    
      user.tid = result.tid;
      user.psid = result.psid;
    
      // request for name
      const url = "https://graph.facebook.com/v2.6/" + user.psid + "?fields=first_name,last_name&access_token=" + pageAccessToken
      
      fetch(url).then((response)=>{
        return response.json()
      }).then((json)=>{
        if (json.first_name !== undefined){
          user.name = json.first_name + " " + json.last_name
        } else {
          user.name = "Someone"
        }
        client.init();
      }).catch((error)=>{
        alert(error);
      })
  },
    function error(error, message){
      // probably on desktop no permission
      render(<h3>Sorry, Messenger Extensions are currently only available for iOS and Android.</h3>, document.getElementById('app'));
    });
};

class LoginButton extends React.Component {
  constructor(props){
    super(props);
  }
  handleClick(e){    
    var query = {
      client_id: client_id,
      response_type: 'code',
      redirect_uri: redirect_uri,
      scope: 'user-modify-playback-state user-read-playback-state user-library-read user-top-read user-top-read'
    };
    window.location = 'https://accounts.spotify.com/authorize?' + querystring.stringify(query);
  }
  render(){
    return (
      <div id="login">
      <h1>Tutti</h1>
      <button type='button' onClick={this.handleClick}>Join this session</button>
      </div>
    );
  }  
}



class TrackRow extends React.Component {
  constructor(props){
    super(props);
    this.handleClick = this.handleClick.bind(this);    
  }
  handleClick(e) {
    // share message
    client.playSong(this.props.trackInfoMap);

  }
  render() {
    return (
      <li onClick={this.handleClick} key={this.props.trackInfoMap['id'].toString()}>
        <div className="title">{this.props.trackInfoMap['name']}</div>
        <div className="subtitle">{this.props.trackInfoMap['artist']}</div>
      </li>
    );    
  }
}

class SavedSongsList extends React.Component {
  constructor(props){ 
    super(props);
    this.state = {
      savedSongs: []
    }; 
  }

  componentDidMount(){
    let self = this
    client.getSavedSongs()
    .then((json)=> {
      var tracks = json.tracks;
      console.log("tracks: ", tracks)
      const listTracks = tracks.map((track) =>{
        var trackInfoMap = {}
        var artists = track.artists;
        trackInfoMap['name'] = track.name;
        trackInfoMap['uri'] = track.uri;
        trackInfoMap['duration'] = track.duration_ms;
        trackInfoMap['id'] = track.id;
        trackInfoMap['image'] = track.album.images[0].url;
        var artistNames = [];
        for (var j = 0; j < artists.length; j++){
          artistNames.push(artists[j].name);
        }
        trackInfoMap['artist'] = artistNames.join(', ');
          
        return <TrackRow trackInfoMap={trackInfoMap} key={track.id} />
      });
      self.setState({
        savedSongs: listTracks
      });
    }).then(()=> {
      // join after component mounts so they dont both try to renew tokens
      // client.join();
    }).catch(function(ex) {
      return false;
    });  
  }
  
  render() {
    return (
      <div className="songs-list">
        <ul>
          <li className="header">Recommended</li>
          {this.state.savedSongs}
        </ul>  
      </div>
    );
  }
}


class ResultsList extends React.Component {
  render() {
    // search spotify
    return(
      <div className="songs-list">
        <ul>
          {this.props.searchResults}
        </ul>
      </div>
    );
  }
}

class SearchBar extends React.Component {
  constructor(props) {
    super(props);
    
    this.handleFocus = this.handleFocus.bind(this);
    this.handleBlur = this.handleBlur.bind(this);

    this.handleSearchTextInput = this.handleSearchTextInput.bind(this);
    var timeouted;
  }

  handleSearchTextInput(event) {
    clearTimeout(self.timeouted);
    self.timeouted = setTimeout(this.props.onSearchTextInput(event.target.value), 100);
  }
  
  handleFocus(){
    this.props.onFocusSearch();
  }
  
  handleBlur(){
    this.props.onBlurSearch();
  }
  
  render() {
    return (
      <div id="searchBar">        
        <input id="searchInput" type="search" placeholder="Search for music" onChange={this.handleSearchTextInput} onFocus={this.handleFocus} onBlur={this.handleBlur}/>
      </div>
    );
  }
}
class Helper extends React.Component {
  constructor(props) {
    super(props);
    // questions
    this.questions = [
      "Music should be playing. Need help?",
      "Is Spotify open and running?",
      "Can you play a song from the Spotify app?"
    ]
    this.questionIndex = 0
    this.state = {
      isWorking: true,
      question: this.questions[this.questionIndex]
    }
    this.handleClick = this.handleClick.bind(this);
  }
  handleClick(){
    client.join()
    if (this.questionIndex == 2){
      this.questionIndex = 0
    } else {
      this.questionIndex += 1
    }
    
    this.setState({
      question:this.questions[this.questionIndex]
    })
  }

  render() {
    return (
      <li>
        <div className="helper">
          <span>{this.state.question}</span>
          <button onClick={this.handleClick} type="button">Yes</button>
        </div>
      </li>
    );
  }


}
class Player extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: "",
      artist: "",
      image: "",
      isPlaying: false,
      users:[]
    };
    this.handlePlayingChange = this.handlePlayingChange.bind(this);

  }
  componentDidMount() {
    this.getThread()
    this.timerID = setInterval(
      () => this.getThread(),
      5000
    );
    
    client.join();
  }
  componentWillUnmount() {
    clearInterval(this.timerID);
  }
  handlePlayingChange(isPlaying){
    this.props.onPlayingChange(isPlaying)
  }
  getThread() {
    let self = this



    var url = serverURL + '/thread/' + user.tid 
    var options = {
      method:'GET',
    };
    let request = fetch(url, options);
    request.then(function(response){
      return response.json()
    }).then(function(json){
      if (json.now_playing !== undefined){
        const offset = (Date.now()) - json.now_playing.start;
        
        const isPlaying = offset < json.now_playing.duration;

        if (isPlaying !== self.state.isPlaying){
          self.handlePlayingChange(isPlaying)
        }
        
        const otherUsers = json.users.map((user)=>{
          return user.name
        })
        
        self.setState({
          name:json.now_playing.name,
          artist:json.now_playing.artist,
          image:json.now_playing.image,
          isPlaying: isPlaying,
          users: otherUsers
        })
      }
    }).catch(function(error){
      console.log(error)
    });
  }
  render() {
    const otherUsers = this.state.users.filter(e => e !== user.name);
    console.log("otherUsers: ", otherUsers);
    const listeners = "You, " + otherUsers.join(", ")
    
    if (!this.state.name || !this.state.isPlaying){
      return (
        <div className="player">
          <ul>
            <li className="header">No song queued :(</li>
          </ul>
        </div>
      );   
    } else {
      return (
        <div className="player">
          <ul>
            <li className="header">Now Playing</li>
            <li>
              <div className="now-playing">
                <img src={this.state.image}/>
                <div className="title">{this.state.name}</div>
                <div className="subtitle">{this.state.artist}</div>
              </div>
            </li>
            <li className="header">Listeners</li>
            <li>{listeners}</li>
            <Helper/>

          </ul>
        </div>
      );
    }
  }
}


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: this.props.searchText,
      searchResults: this.props.searchResults,
      showSearch: this.props.showSearch,
      isPlaying: false
    };
    this.handleFocusSearch = this.handleFocusSearch.bind(this);
    this.handleBlurSearch = this.handleBlurSearch.bind(this);
    this.handleSearchTextInput = this.handleSearchTextInput.bind(this);
    this.handlePlayingChange = this.handlePlayingChange.bind(this);
  }
  componentWillReceiveProps(nextProps){
    this.state = {
      searchText: nextProps.searchText,
      searchResults: nextProps.searchResults,
      showSearch: nextProps.showSearch,
      isPlaying: true
    };
  }
  handleSearchTextInput(searchText) {
    this.setState({
      searchText: searchText
    });
    if (searchText){
      // spotify api call
      client.searchSpotify(searchText)
      .then((json)=> {
        var items = json.tracks.items;          
        const listItems = items.map((item) =>{
          var trackInfoMap = {}
          var artists = item.artists;
          trackInfoMap['name'] = item.name;
          trackInfoMap['uri'] = item.uri;
          trackInfoMap['duration'] = item.duration_ms;
          trackInfoMap['id'] = item.id;
          trackInfoMap['image'] = item.album.images[0].url;
          var artistNames = [];
          for (var j = 0; j < artists.length; j++){
            artistNames.push(artists[j].name);
          }
          trackInfoMap['artist'] = artistNames.join(',');

          return <TrackRow trackInfoMap={trackInfoMap} key={item.id.toString()} />
        });

        this.setState({
          searchResults: listItems
        });
        return true;
      }).catch(function(ex) {
        // getNewAccessToken();
        return false;
      });  
    } else {
      this.setState({
        searchResults: []
      });
    }
  }
  
  handleFocusSearch(){
    this.setState({
      showSearch:true
    })
  }
  handleBlurSearch(){
    // this.setState({
    //   showSearch:false
    // }) 
  }
  handlePlayingChange(isPlaying){
    this.setState({
      isPlaying: isPlaying
    });
  }

  render() {
    // searching state
    
    /* toggle player and search
    return (
      <div>
      <SearchBar
        searchText={this.state.searchText}
        onSearchTextInput={this.handleSearchTextInput}
        onFocusSearch={this.handleFocusSearch}
        onBlurSearch={this.handleBlurSearch}
      />
      {this.state.showSearch && <ResultsList searchResults={this.state.searchResults}/>}
      {this.state.showSearch && <SavedSongsList/>}
      {!this.state.showSearch && <Player/>}
      </div>
    );
    */
    
    return (
      <div>
        <SearchBar
          searchText={this.state.searchText}
          onSearchTextInput={this.handleSearchTextInput}
          onFocusSearch={this.handleFocusSearch}
          onBlurSearch={this.handleBlurSearch}
        />
        <ResultsList searchResults={this.state.searchResults}/>
        <Player
          onPlayingChange={this.handlePlayingChange}
        />
        <SavedSongsList/>
      </div>


    );
    // playing state

  }
}