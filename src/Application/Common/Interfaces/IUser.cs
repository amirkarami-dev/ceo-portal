namespace Mabhas19.Application.Common.Interfaces;

public interface IUser
{
    string? Id { get; }
    string? Name { get; }
    List<string>? Roles { get; }

}
