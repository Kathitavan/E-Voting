import { useEffect, useState } from "react"
import axios from "axios"
import "../styles/adminDashboard.css"
import SystemLoader from "../components/SystemLoader"

import { Pie, Bar } from "react-chartjs-2"
import {
Chart as ChartJS,
ArcElement,
CategoryScale,
LinearScale,
BarElement,
Tooltip,
Legend
} from "chart.js"

ChartJS.register(
ArcElement,
CategoryScale,
LinearScale,
BarElement,
Tooltip,
Legend
)

const API = "http://127.0.0.1:5000"

export default function AdminDashboard(){

const [results,setResults] = useState({})
const [gender,setGender] = useState({})
const [stats,setStats] = useState({})
const [lastUpdate,setLastUpdate] = useState("")
const [loading,setLoading] = useState(true)
const [error,setError] = useState(false)

useEffect(()=>{

fetchData()

const interval = setInterval(fetchData,3000)

return ()=>clearInterval(interval)

},[])


const fetchData = async()=>{

try{

const res = await axios.get(`${API}/admin/results`)

setResults(res.data?.votes || {})
setGender(res.data?.gender_stats || {})
setStats(res.data?.system || {})

setLastUpdate(new Date().toLocaleTimeString())

setLoading(false)

}catch(err){

console.log("Dashboard Error",err)
setError(true)

}

}


const totalVotes = Object.values(results).reduce((a,b)=>a+b,0)

const registered = stats?.registered || 0
const voted = stats?.voted || 0
const remaining = registered - voted

const turnout = registered
? ((voted/registered)*100).toFixed(1)
: 0


const leader =
Object.keys(results).length > 0
? Object.entries(results).sort((a,b)=>b[1]-a[1])[0]
: null


/* CHART DATA */

const pieData = {
labels: Object.keys(results),
datasets:[
{
label:"Votes",
data:Object.values(results),
backgroundColor:[
"#22c55e",
"#3b82f6",
"#f59e0b",
"#ef4444",
"#8b5cf6",
"#14b8a6",
"#ec4899"
]
}
]
}

const genderData = {
labels:["Male","Female"],
datasets:[
{
label:"Votes",
data:[
gender?.male || 0,
gender?.female || 0
],
backgroundColor:["#3b82f6","#ec4899"]
}
]
}


/* LOADING SCREEN */

if(loading){
return <SystemLoader message="Loading election analytics..." />
}

/* ERROR SCREEN */

if(error){

return(
<div className="admin-loading">
Backend connection failed
</div>
)

}


return(

<div className="admin-container">

<h1 className="admin-title">
Election Command Dashboard
</h1>

<p className="refresh-info">
Live updates every 3 seconds • Last update {lastUpdate}
</p>


{/* SYSTEM STATS */}

<div className="admin-grid">

<div className="card">
<h2>Total Votes</h2>
<p>{totalVotes}</p>
</div>

<div className="card">
<h2>Registered Voters</h2>
<p>{registered}</p>
</div>

<div className="card">
<h2>Remaining Voters</h2>
<p>{remaining}</p>
</div>

<div className="card">
<h2>Turnout</h2>
<p>{turnout}%</p>

<div className="turnout-bar">
<div
className="turnout-fill"
style={{width:`${turnout}%`}}
></div>
</div>

</div>

</div>


{/* LEADING PARTY */}

{leader && (

<div className="leader-card">

<h2>Leading Party</h2>

<h1>{leader[0]}</h1>

<p>{leader[1]} votes</p>

</div>

)}


{/* PARTY RESULTS */}

<h2 className="section">
Party Results
</h2>

<div className="results">

{Object.keys(results).length === 0 && (
<p>No votes recorded yet</p>
)}

{Object.entries(results).map(([party,votes])=>(

<div className="result-row" key={party}>

<span className="party-name">
{party}
</span>

<div className="bar">

<div
className="fill"
style={{
width:`${totalVotes ? (votes/totalVotes)*100 : 0}%`
}}
></div>

</div>

<span className="vote-count">
{votes}
</span>

</div>

))}

</div>


{/* GENDER ANALYTICS */}

<h2 className="section">
Gender Voting
</h2>

<div className="gender">

<div className="gender-box">
<h3>Male</h3>
<p>{gender?.male || 0}</p>
</div>

<div className="gender-box">
<h3>Female</h3>
<p>{gender?.female || 0}</p>
</div>

</div>


{/* CHART ANALYTICS */}

<h2 className="section">
Election Analytics
</h2>

<div className="chart-grid">

<div className="chart-card">
<h3>Party Vote Distribution</h3>
{totalVotes > 0 ? <Pie data={pieData}/> : <p>No vote data</p>}
</div>

<div className="chart-card">
<h3>Gender Voting</h3>
<Bar data={genderData}/>
</div>

</div>

</div>

)

}