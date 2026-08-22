const inputBox = document.getElementById("input-box");
const listContainer = document.getElementById("list-container");

function addTask() {
  if(inputBox.value === '') {
    alert("You must write something first");
  } 
  else{
    let li = document.createElement("li");
    li.innerHTML = inputBox.value;
    listcontainer.appendChild(li);
  }
  inputBox.value = "";
}
