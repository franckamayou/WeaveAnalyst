/**
 * contains all the functions required for project management 
 */
angular.module('aws.project')
.service('projectService', ['$q', '$rootScope', 'WeaveService', 'runQueryService','queryService', 'projectManagementURL',
                            function($q, scope, WeaveService, runQueryService,queryService, projectManagementURL){
	
	var that = this;
	
	this.cache= {
			project: {selected : null},
			listOfProjectsFromDatabase : [],
			returnedQueryObjects : [],
			columnstring : "", 
			projectDescription : "", 
			userName : "", 
			weaveSessionState : "",
			deleteProjectStatus : null, 
			deleteQueryObjectStatus : null, 
			insertQueryObjectStatus : null 
	};

	
	
	/**
     * This function wraps the async aws getListOfProjects function into an angular defer/promise
     * So that the UI asynchronously wait for the data to be available...
     */
   
    this.getListOfProjects = function() {
    	var deferred = $q.defer();
    	runQueryService.queryRequest(projectManagementURL, 'getProjectListFromDatabase', null, function(result){
			that.cache.listOfProjectsFromDatabase = result;
        
			scope.$safeApply(function() {
				deferred.resolve(result);
			});
		
		});
    };
    
    /**
     * This function wraps the async aws getQueryObjectsInProject function into an angular defer/promise
     * So that the UI asynchronously wait for the data to be available...
     */
    this.getListOfQueryObjects = function(projectName) {
    	var deferred = $q.defer();
    	runQueryService.queryRequest(projectManagementURL, 'getListOfQueryObjects', [projectName], function(AWSQueryObjectCollection){
    		that.cache.returnedQueryObjects = [];
    		if(!(angular.isUndefined(AWSQueryObjectCollection)))
    			{    			
        			var countOfJsons = AWSQueryObjectCollection.length;
        			for(var i = 0; i < countOfJsons; i++)
        			{
                var currentQueryObject = AWSQueryObjectCollection[i];
        				var singleObject= {};
        				singleObject.queryObject = JSON.parse(currentQueryObject.finalQueryObject);
        				singleObject.queryObjectName = currentQueryObject.queryObjectName;
        				singleObject.projectDescription = currentQueryObject.projectDescription;
        				that.cache.projectDescription = currentQueryObject.projectDescription;
        				if(angular.isUndefined(currentQueryObject.thumbnail)){
        					singleObject.thumbnail = undefined;
        					console.log("This queryObject does not contain any stored visualizations");
        				}
        				else{
        					
        					singleObject.thumbnail = "data:image/png;base64," + currentQueryObject.thumbnail;
        				}
        				
        				
                /* Build column string */
        				that.cache.columnstring = "";
        				var columns = singleObject.queryObject.scriptOptions;
        				console.log("cols: ", columns);
        				for(var j in columns){
        					var title = columns[j].metadata.title;
        					that.cache.columnstring= that.cache.columnstring.concat(title) + ", ";
        				}
        				singleObject.columnstring = that.cache.columnstring.slice(0,-2);//getting rid of the last comma
        				

                /* Build filter string */
                var column, selection, key;
                var filterStrings = [];
                var geoFilterOptions = singleObject.queryObject.GeographyFilter;
                if (geoFilterOptions.geometrySelected)
                {
                  var filterString = "";

                  if (geoFilterOptions.countyColumn)
                  {
                    selection = geoFilterOptions.selectedCounties;
                    column = geoFilterOptions.countyColumn;
                  }
                  else if (geoFilterOptions.stateColumn)
                  {
                    selection = geoFilterOptions.selectedStates;
                    column = geoFilterOptions.stateColumn;
                  }
                  
                  if (column && selection)
                  {
                    var selectionStrings = [];
                    for (key in selection)
                    {
                      selectionStrings.push(selection[key].title || key);
                    }
                    filterStrings.push(column.metadata.title + ": " + selectionStrings.join(", "));
                  }
                }
                if (singleObject.queryObject.rangeFilters.filter)
                {
                  column = singleObject.queryObject.rangeFilters.filter.column;
                  selectionStrings = [singleObject.queryObject.rangeFilters.filter.min, singleObject.queryObject.rangeFilters.filter.max];
                  filterStrings.push(column.metadata.title + ":" + selectionStrings.join("-"));
                }
                singleObject.filterString = filterStrings.join("; ");

                that.cache.returnedQueryObjects[i] = singleObject;
        			}
        			
    			}else{
    				that.cache.project.selected = "";
    				that.cache.projectDescription = "";
    				that.cache.userName = "";
    			}
    		
	    		scope.$safeApply(function() {
	                deferred.resolve(AWSQueryObjectCollection);
	            });
        	
        });
    	
    	return deferred.promise;
    };
    
    /**
     * returns the base64 encoded session state of the visualizations generated by a query object
     */
    this.getBase64SessionState = function(params){
    	if(!(WeaveService.weaveWindow.closed)){
    		var base64SessionState = WeaveService.getBase64SessionState();
    		queryService.queryObject.weaveSessionState = WeaveService.getSessionStateObjects();//TODO fix this adding properties dynamically not GOOD
    		this.writeSessionState(base64SessionState, params);
    	}
    };
   
    this.writeSessionState = function(base64String, params){
    	var projectName;
    	var userName;
    	var queryObjectTitles;
    	var projectDescription;
    	
    	if(angular.isDefined(params.projectEntered))
    		{
	    		projectName = params.projectEntered;
	    		projectDescription = "This project belongs to " + projectName;
    		}
    	else
    		{
	    		projectName = "Other";
	    		projectDescription = "These query objects do not belong to any project"; 
    		}
    	if(angular.isDefined(params.queryTitleEntered)){
    		queryObjectTitles = params.queryTitleEntered;
    		queryService.queryObject.title = queryObjectTitles;
    	}
    	else
    		 queryObjectTitles = queryService.queryObject.title;
    	if(angular.isDefined(params.userName)){
    		userName = params.userName;
    		queryService.queryObject.author = userName;
    	}
    	else
    		userName = "Awesome User";
    	

    	var queryObjectJsons = angular.toJson(queryService.queryObject);
    	var resultVisualizations = base64String;
    	
    	
    	runQueryService.queryRequest(projectManagementURL, 'writeSessionState', [userName, projectDescription, queryObjectTitles, queryObjectJsons, resultVisualizations, projectName], function(result){
    		console.log("adding status", result);
    		alert(queryObjectTitles + " has been added");
    	});
    };
    
    
    /**
     * this function returns the session state corresponding to the thumbnail of a query object that was clicked
     */
    this.returnSessionState = function(queryObject){
   	 var deferred = $q.defer();
   	 queryObject = angular.toJson(queryObject);
   	 //console.log("stringified queryObject", queryObject);
   	 
   	 runQueryService.queryRequest(projectManagementURL, 'getSessionState', [queryObject], function(result){
    		
   		 that.cache.weaveSessionState = result;
   		 
        	scope.$safeApply(function() {
                deferred.resolve(result);
            });
        	
        });
    		
  
		return deferred.promise;
   };
   
   	//as soon as service returns deleteStatus
	//1. report status
	//2. reset required variables
	//3. updates required lists
   /**
    * This function wraps the async aws deleteproject function into an angular defer/promise
    * So that the UI asynchronously wait for the data to be available...
    */
   this.deleteProject = function(projectName) {
   	var deferred = $q.defer();
   	runQueryService.queryRequest(projectManagementURL, 'deleteProjectFromDatabase', [projectName], function(result){
           
       	that.cache.deleteProjectStatus = result;//returns an integer telling us the number of row(s) deleted
       	
      	 if(! (that.cache.deleteProjectStatus == 0 )){
      		 
      		that.cache.returnedQueryObjects = [];//reset
      		that.cache.projectDescription = "";
      		 alert("The Project " + projectName + " has been deleted");
      		 that.getListOfProjects();//call the updated projects list
      	 }
      	 
      	 that.cache.deleteProjectStatus = 0;//reset 
       	
       	scope.$safeApply(function() {
               deferred.resolve(result);
           });
       	
       });
       
       return deferred.promise;
       
   };
   
   /**
    * This function wraps the async aws deleteQueryObject function into an angular defer/promise
    * So that the UI asynchronously wait for the data to be available...
    */
   this.deleteQueryObject = function(projectName, queryObjectTitle){
	   var deferred = $q.defer();
	   runQueryService.queryRequest(projectManagementURL, 'deleteQueryObjectFromProject', [projectName, queryObjectTitle], function(result){
	       	that.cache.deleteQueryObjectStatus = result;
	       	console.log("in the service",that.cache.deleteQueryObjectStatus );
	       	
	       	alert("Query Object " + queryObjectTitle + " has been deleted");
	       	
	       	that.cache.returnedQueryObjects = [];//clears list
	       	
	       	that.getListOfQueryObjects(projectName);//fetches new list
	       	
	       	//if the project contained only one QO which was deleted , retrive the new updated lists of projects
	       	if(that.cache.returnedQueryObjects.length == 0){
	       		
	       		that.getListOfProjects();
	       		
	       		that.cache.project.selected = "";
	       	}
	       	scope.$safeApply(function() {
	               deferred.resolve(result);
	           });
	       	
	       });
	       
	       return deferred.promise;
   };
   
   /**
    * This function wraps the async aws insertQueryObjectToProject function into an angular defer/promise
    * adds a query object (row) to the specified project in the database
    * So that the UI asynchronously wait for the data to be available...
    */
   this.insertQueryObjectToProject = function(userName, projectName, projectDescription,queryObjectTitles,queryObjectJsons, resultVisualizations){
 
   	var deferred = $q.defer();

   	runQueryService.queryRequest(projectManagementURL, 'insertMultipleQueryObjectInProjectFromDatabase', [userName,
   	                                                                                          projectName,
   	                                                                                          projectDescription,
   	                                                                                          queryObjectTitles,
   	                                                                                          queryObjectJsons,
   	                                                                                          resultVisualizations], function(result){
   		that.cache.insertQueryObjectStatus = result;//returns an integer telling us the number of row(s) added
       	console.log("insertQueryObjectStatus", that.cache.insertQueryObjectStatus);
       	if(that.cache.insertQueryObjectStatus != 0){
       		alert(that.cache.insertQueryObjectStatus + " Query Object(s)" +  " have been added to project:" + projectName);
       	}
       	
       	scope.$safeApply(function() {
               deferred.resolve(result);
           });
       	
       });
       
       return deferred.promise;
       
   };
   
   this.createNewProject = function(userNameEntered, projectNameEntered,projectDescriptionEntered, queryObjectTitles, queryObjectJsons){
	   that.insertQueryObjectToProject(userNameEntered,
			   						   projectNameEntered,
			   						   projectDescriptionEntered,
			   						   queryObjectTitles,
			   						   queryObjectJsons,
			   						   null)
	   .then(function(){
		   that.cache.listOfProjectsFromDatabase = [];//clear
		   that.getListOfProjects();//fetch new list
	   });

   };
   
}]);
