using System.Collections.Concurrent;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();
app.UseCors("AllowAll");

var db = new FakeDb();

// === Endpoints ===

app.MapGet("/health", () => new { status = "healthy", db = "populed-mock", items = db.Tickets.Count });

// Services & Counters
app.MapGet("/api/services", () => Results.Json(db.Services));
app.MapGet("/api/counters", () => Results.Json(db.Counters));

// Appointments (Mock for DNI)
app.MapGet("/api/appointments", (string? doc) =>
{
    Console.WriteLine($"[API] Getting Appointments: {doc}");
    if (doc?.ToUpper().Contains("12345678") == true)
    {
        return Results.Json(new[]
        {
            new { id = "apt-1", docValue = "12345678A", serviceId = "C", title = "Consulta General", time = "10:30", doctor = "Dr. García", room = "Consulta 1" },
            new { id = "apt-2", docValue = "12345678A", serviceId = "E", title = "Extracciones", time = "11:15", doctor = "Enfermera López", room = "Box 2" }
        });
    }
    return Results.Json(new object[] { });
});

// Queues (Waiting tickets)
app.MapGet("/api/queues/{serviceId}", (string serviceId) =>
{
    Console.WriteLine($"[API] Fetching queue for ServiceId: {serviceId}");
    // Return Waiting, Called AND Serving so operator sees them all if needed
    var q = db.Tickets.Where(t => t.ServiceId == serviceId && (t.Status == "Waiting" || t.Status == "Called" || t.Status == "Serving"))
                      .OrderBy(t => t.EnqueuedAt)
                      .ToList();
    return Results.Json(q);
});

app.MapGet("/api/tickets/active-by-doc", (string doc) => Results.Json(new object[]{}));
app.MapGet("/api/tickets/by-code/{code}", (string code) => 
{
    var t = db.Tickets.FirstOrDefault(x => x.Code == code);
    return t != null ? Results.Json(t) : Results.NotFound();
});

// Display (TV)
app.MapGet("/api/display", () =>
{
    // Now Serving: Called or Serving
    // IMPORTANT: Include Serving for overlay
    var nowServing = db.Tickets.Where(t => t.Status == "Called" || t.Status == "Serving")
                                .OrderByDescending(t => t.CalledAt)
                                .Take(4)
                                .Select(t => new { t.Code, t.ServiceName, t.CounterName, t.Status })
                                .ToList();

    // Next: Waiting
    var next = db.Tickets.Where(t => t.Status == "Waiting")
                         .OrderBy(t => t.EnqueuedAt)
                         .Take(8)
                         .Select(t => new { t.Code, t.ServiceName, t.CounterName, t.Status })
                         .ToList();

    return Results.Json(new { nowServing, next });
});

// Create Ticket (Kiosk) - Accepts Body
app.MapPost("/api/tickets", (CreateTicketRequest req) =>
{
    string letter = req.ServiceId ?? "A";
    
    // If walk-in (no appointment), just generate
    var t = new Ticket 
    { 
        Code = letter + "-" + new Random().Next(200, 999), 
        ServiceId = letter, 
        ServiceName = GetServiceName(letter),
        Status = "Waiting",
        EnqueuedAt = DateTime.UtcNow
    };
    db.Tickets.Add(t);
    Console.WriteLine($"[API] Created Ticket {t.Code} for Service {letter}");
    return Results.Json(t);
});

// Create Ticket (Simple fallback)
app.MapPost("/api/queue/ticket", () =>
{
    var t = new Ticket 
    { 
        Code = "A-" + new Random().Next(200, 300), 
        ServiceId = "A", 
        ServiceName = "Admisión",
        Status = "Waiting",
        EnqueuedAt = DateTime.UtcNow
    };
    db.Tickets.Add(t);
    return Results.Json(t);
});

// Actions
app.MapPost("/api/actions/call/{ticketId}", (string ticketId, string? counterId) =>
{
    Console.WriteLine($"[API] Call Specific: {ticketId} @ {counterId}");
    var t = db.Tickets.FirstOrDefault(x => x.Id == ticketId || x.Code == ticketId); // Try both
    if (t != null)
    {
         t.Status = "Called";
         t.CalledAt = DateTime.UtcNow;
         t.CounterId = counterId ?? "adm1";
         t.CounterName = GetCounterName(t.CounterId);
         return Results.Json(t);
    }
    return Results.NotFound();
});

app.MapPost("/api/actions/start/{ticketId}", (string ticketId) =>
{
    Console.WriteLine($"[API] Start: {ticketId}");
    var t = db.Tickets.FirstOrDefault(x => x.Id == ticketId || x.Code == ticketId);
    if (t != null)
    {
         t.Status = "Serving"; // Update status!
         t.StartedAt = DateTime.UtcNow;
         return Results.Json(t);
    }
    return Results.NotFound();
});

app.MapPost("/api/actions/finish/{ticketId}", (string ticketId) =>
{
    Console.WriteLine($"[API] Finish: {ticketId}");
    var t = db.Tickets.FirstOrDefault(x => x.Id == ticketId || x.Code == ticketId);
    if (t != null)
    {
         t.Status = "Finished";
         t.FinishedAt = DateTime.UtcNow;
         return Results.Json(t);
    }
    return Results.NotFound();
});

app.MapPost("/api/actions/noshow/{ticketId}", (string ticketId) =>
{
     var t = db.Tickets.FirstOrDefault(x => x.Id == ticketId || x.Code == ticketId);
     if (t != null) { t.Status = "NoShow"; return Results.Json(t); }
     return Results.NotFound();
});


// Call Next (Legacy)
app.MapPost("/api/actions/call-next", (string? serviceId, string? counterId) =>
{
    Console.WriteLine($"[API] Call Next: {serviceId} @ {counterId}");
    var next = db.Tickets.Where(t => t.ServiceId == serviceId && t.Status == "Waiting")
                       .OrderBy(t => t.EnqueuedAt)
                       .FirstOrDefault();
    
    if (next != null)
    {
        next.Status = "Called";
        next.CalledAt = DateTime.UtcNow;
        next.CounterId = counterId ?? "adm1";
        next.CounterName = GetCounterName(next.CounterId);
    }
    return Results.Json(new { success = true, ticket = next });
});

// Analytics Summary
app.MapGet("/api/analytics/summary", () =>
{
    return Results.Json(new 
    {
        totalTickets = db.Tickets.Count,
        avgWaitTime = 12,
        avgServiceTime = 8,
        servedCount = db.Tickets.Count(t => t.Status == "Finished"),
        byService = new { consulta = 20, extracciones = 15, urgencias = 5 },
        hourlyStats = new[] { 
            new { hour = "08:00", count = 5 },
            new { hour = "09:00", count = 12 },
            new { hour = "10:00", count = 18 },
            new { hour = "11:00", count = 25 },
            new { hour = "12:00", count = 10 }
        }
    });
});

app.MapGet("/api/analytics/events", () => Results.Json(new object[] {}));

// Auth
app.MapPost("/api/auth/login", () => Results.Ok(new { token = "mock-token", user = new { username = "op1", role = "Operator" } }));

app.Run();

// === Utils ===
string GetServiceName(string letter) => letter switch
{
    "A" => "Admisión",
    "E" => "Extracciones",
    "C" => "Consulta General",
    "V" => "Vacunación",
    _ => "General"
};

string GetCounterName(string id) => id switch
{
    "adm1" => "Mesa 1",
    "ext1" => "Box 1",
    "con1" => "Consulta 1",
    "vac1" => "Sala 1",
     _ => "Puesto " + id
};


// === Fake Database & Models (MUST BE AT BOTTOM) ===

public class Ticket
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Code { get; set; } = "";
    public string ServiceId { get; set; } = "";
    public string ServiceName { get; set; } = "";
    public string Status { get; set; } = "Waiting"; 
    public DateTime EnqueuedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CalledAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string? CounterId { get; set; }
    public string? CounterName { get; set; }
}

public class CreateTicketRequest
{
    public string? Doc { get; set; }
    public string? ServiceId { get; set; }
    public string? AppointmentId { get; set; }
    public string? Source { get; set; }
}

public class FakeDb
{
    public List<Ticket> Tickets { get; set; } = new();
    public List<object> Services { get; set; } = new();
    public List<object> Counters { get; set; } = new();

    public FakeDb()
    {
        // Seed Services
        Services.Add(new { id = "A", name = "Admisión", letter = "A" });
        Services.Add(new { id = "E", name = "Extracciones", letter = "E" });
        Services.Add(new { id = "C", name = "Consulta General", letter = "C" });
        Services.Add(new { id = "V", name = "Vacunación", letter = "V" });

        // Seed Counters
        Counters.Add(new { id = "adm1", name = "Mesa 1", serviceId = "A", isActive = true });
        Counters.Add(new { id = "ext1", name = "Box 1", serviceId = "E", isActive = true });
        Counters.Add(new { id = "con1", name = "Consulta 1", serviceId = "C", isActive = true });
        Counters.Add(new { id = "vac1", name = "Sala 1", serviceId = "V", isActive = true });

        // Seed Tickets (Past & Present)
        var rnd = new Random();
        var letters = new[] { "A", "E", "C", "V" }; 
        
        // 1. Finished
        for (int i = 1; i <= 50; i++)
        {
            var letter = letters[rnd.Next(letters.Length)];
            var id = i;
            Tickets.Add(new Ticket
            {
                Code = $"{letter}-{id:D3}",
                ServiceId = letter, 
                ServiceName = GetServiceName(letter),
                Status = "Finished",
                EnqueuedAt = DateTime.UtcNow.AddHours(-rnd.Next(1, 8)),
                CalledAt = DateTime.UtcNow.AddHours(-rnd.Next(1, 8)).AddMinutes(5),
                StartedAt = DateTime.UtcNow.AddHours(-rnd.Next(1, 8)).AddMinutes(6),
                FinishedAt = DateTime.UtcNow.AddHours(-rnd.Next(1, 8)).AddMinutes(15),
                CounterId = "adm1", 
                CounterName = "Mesa Mock"
            });
        }

        // 2. Waiting (Plenty of Admision)
        for (int i = 100; i <= 150; i++)
        {
            var letter = letters[rnd.Next(letters.Length)];
            if (i % 3 == 0) letter = "A"; 

            Tickets.Add(new Ticket
            {
                Code = $"{letter}-{i:D3}",
                ServiceId = letter,
                ServiceName = GetServiceName(letter),
                Status = "Waiting",
                EnqueuedAt = DateTime.UtcNow.AddMinutes(-rnd.Next(0, 120))
            });
        }
    }
    
    // Helper within DB class for seed usage
    private string GetServiceName(string letter) => letter switch
    {
        "A" => "Admisión",
        "E" => "Extracciones",
        "C" => "Consulta General",
        "V" => "Vacunación",
        _ => "General"
    };
}
