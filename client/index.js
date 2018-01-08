import React from 'react';
import { render } from 'react-dom';
import querystring from 'querystring';

var APP_ID = 1737594129877596;

var user = { // fix default values
  psid: 'user_2',
  tid: 'thread_1'
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
  init(tid, psid) {    
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
          psid: user.psid
        })
      }
      this.performSpotifyRequest(url, options)
      .then(function(json){
        accessToken = json.access_token;
        refreshToken = json.refresh_token;

        render(<App/>, document.getElementById('app'));  
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
          throw Error
        }
      }).then(function(json){
        accessToken = json.access_token;
        refreshToken = json.refresh_token;

        render(<App/>, document.getElementById('app'));  

      }).catch(function(error){
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
        'access_token': accessToken,
        'refresh_token': refreshToken
      })};
    var url = serverURL + '/join'


    fetch(url, options).then(function(response) {
      if (response.status == 204){
        //close webview then alert
          window.alert("Make sure Spotify is opened. Play or pause any song to make sure it's actively running then let Tutti take over.")
        
          // window.MessengerExtensions.requestCloseBrowser(null, null)  
      }
      
      
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
    var query = {
      limit: '5'
    };
    let url = 'https://api.spotify.com/v1/me/tracks?' + querystring.stringify(query)
    let options = {
      method: 'GET',
      headers: {
       'Authorization': 'Bearer ' + accessToken
      }    
    };
    return this.performSpotifyRequest(url, options)
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
        window.MessengerExtensions.requestCloseBrowser(null, null);

        let request = fetch(url, options);
        request
        .then(function (response) {
          // figure out if bad token
          if (response.status != 200){
            window.alert("Make sure Spotify is opened. Play or pause any song to make sure it's actively running then let Tutti take over.")
            throw Error;
          } else {
            return response.json()      
          }
        })
      } 
    }, function error(errorCode, errorMessage) {      
    // An error occurred in the process
      alert('Make sure Spotify is running on your device');
    },
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

      client.init(user.tid, user.psid)

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
      scope: 'user-modify-playback-state user-read-playback-state user-library-read'
    };
    window.location = 'https://accounts.spotify.com/authorize?' + querystring.stringify(query);
  }
  render(){
    return (
      <div id="login">
      <h1>Tutti</h1>
      <h3>Listen to any song from Spotify with your friends on Facebook. Make sure Spotify is open on your device and Tutti will take care of the rest.</h3>
      <button type='button' onClick={this.handleClick}>Login with Spotify</button>
      </div>
    );
  }  
}

class NowPlaying extends React.Component {
  constructor(props){
    super(props);
    // fetch now playing from db
    this.nowPlaying = props.nowPlaying;
  }
  render(){
    return (
      <div id="now_playing">
        <img src={this.nowPlaying.image}></img>
        <h4>{this.nowPlaying.name}</h4>
        <h4>{this.nowPlaying.artist}</h4>
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
      var items = json.items;
      var rows = [];
      rows.push(<li>Recommended</li>)
      for (var i=0; i < items.length; i++) {
        var trackInfoMap = {}
        var artists = items[i].track.album.artists;
        trackInfoMap['name'] = items[i].track.name;
        trackInfoMap['uri'] = items[i].track.uri;
        trackInfoMap['duration'] = items[i].track.duration_ms;
        trackInfoMap['id'] = items[i].track.id;
        trackInfoMap['image'] = items[i].track.album.images[0].url;
        var artistNames = [];
        for (var j = 0; j < artists.length; j++){
          artistNames.push(artists[j].name);
        }
        trackInfoMap['artist'] = artistNames.join(', ');
        rows.push(<TrackRow trackInfoMap={trackInfoMap} key={items[i].id} />);
      }
      self.setState({
        savedSongs: rows
      });
    }).then(()=> {
      // join after component mounts so they dont both try to renew tokens
      client.join();
    }).catch(function(ex) {
      return false;
    });  
  }
  
  render() {
    return (
      <ul>
        {this.state.savedSongs}
      </ul>  
    );
  }
}
class NowPlayingList extends React.Component {
  render() {
    // search spotify
    return(
      <ul>
        {this.props.searchResults}
      </ul>
    );
  }
}
class SearchBar extends React.Component {
  constructor(props) {
    super(props);
    this.handleSearchTextInput = this.handleSearchTextInput.bind(this);
    var timeouted;
  }
  handleSearchTextInput(event) {
    clearTimeout(self.timeouted);
    self.timeouted = setTimeout(this.props.onSearchTextInput(event.target.value), 100);
  }
  render() {
    return (
      <div id="searchBar">        
        <input type="search" placeholder="Search for music" onChange={this.handleSearchTextInput} />
      </div>
    );
  }
}
class ResultsList extends React.Component {
  render() {
    // search spotify
    return(
      <ul>
        {this.props.searchResults}
      </ul>
    );
  }
}
class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      searchResults: []
    };
    this.handleSearchTextInput = this.handleSearchTextInput.bind(this);
  }
  handleSearchTextInput(searchText) {
    this.setState({
      searchText: searchText
    });
    var rows = []
    if (searchText){
      // spotify api call
      client.searchSpotify(searchText)
      .then((json)=> {
        var items = json.tracks.items;
        for (var i=0; i < items.length; i++) {
          var trackInfoMap = {}
          var artists = items[i].artists;
          trackInfoMap['name'] = items[i].name;
          trackInfoMap['uri'] = items[i].uri;
          trackInfoMap['duration'] = items[i].duration_ms;
          trackInfoMap['id'] = items[i].id;
          trackInfoMap['image'] = items[i].album.images[0].url;
          var artistNames = [];
          for (var j = 0; j < artists.length; j++){
            artistNames.push(artists[j].name);
          }
          trackInfoMap['artist'] = artistNames.join(',');
          rows.push(<TrackRow trackInfoMap={trackInfoMap} key={items[i].id} />);
        }
        this.setState({
          searchResults: rows
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
  render() {
    return (
      <div>
        <SearchBar
          searchText={this.state.searchText}
          onSearchTextInput={this.handleSearchTextInput}
        />
        <ResultsList
          searchResults={this.state.searchResults}
        />
        <SavedSongsList/>
      </div>
    );
  }
}
